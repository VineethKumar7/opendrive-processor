#include "opendrive/route_planner.hpp"
#include <queue>
#include <unordered_set>
#include <algorithm>
#include <random>
#include <chrono>

namespace opendrive {

// ============ Route Planner ============

RoutePlanner::RoutePlanner(const OpenDriveMap& map, double graphResolution)
    : map_(map) {
    graph_.buildFromMap(map, graphResolution);
}

double RoutePlanner::heuristic(size_t nodeA, size_t nodeB) const {
    // Euclidean distance heuristic
    return graph_.node(nodeA).position.distanceTo(graph_.node(nodeB).position);
}

std::vector<size_t> RoutePlanner::dijkstra(size_t startNode, size_t goalNode,
                                           const RoutePlannerOptions& options) {
    if (startNode >= graph_.nodeCount() || goalNode >= graph_.nodeCount()) {
        return {};
    }
    
    // Priority queue: (cost, node)
    using PQEntry = std::pair<double, size_t>;
    std::priority_queue<PQEntry, std::vector<PQEntry>, std::greater<PQEntry>> pq;
    
    std::vector<double> dist(graph_.nodeCount(), std::numeric_limits<double>::infinity());
    std::vector<size_t> prev(graph_.nodeCount(), SIZE_MAX);
    
    dist[startNode] = 0;
    pq.push({0, startNode});
    
    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();
        
        if (u == goalNode) break;
        if (d > dist[u]) continue;  // Stale entry
        
        const RoadNode& node = graph_.node(u);
        
        for (size_t i = 0; i < node.neighbors.size(); ++i) {
            size_t v = node.neighbors[i];
            double edgeCost = node.costs[i];
            
            // Apply penalties
            if (graph_.node(v).roadId != node.roadId) {
                edgeCost += options.turnPenalty;
            }
            
            double newDist = dist[u] + edgeCost;
            if (newDist < dist[v]) {
                dist[v] = newDist;
                prev[v] = u;
                pq.push({newDist, v});
            }
        }
    }
    
    // Reconstruct path
    if (dist[goalNode] == std::numeric_limits<double>::infinity()) {
        return {};  // No path found
    }
    
    std::vector<size_t> path;
    for (size_t node = goalNode; node != SIZE_MAX; node = prev[node]) {
        path.push_back(node);
    }
    std::reverse(path.begin(), path.end());
    
    return path;
}

std::vector<size_t> RoutePlanner::astar(size_t startNode, size_t goalNode,
                                        const RoutePlannerOptions& options) {
    if (startNode >= graph_.nodeCount() || goalNode >= graph_.nodeCount()) {
        return {};
    }
    
    // Priority queue: (f_score, node)
    using PQEntry = std::pair<double, size_t>;
    std::priority_queue<PQEntry, std::vector<PQEntry>, std::greater<PQEntry>> openSet;
    
    std::vector<double> gScore(graph_.nodeCount(), std::numeric_limits<double>::infinity());
    std::vector<double> fScore(graph_.nodeCount(), std::numeric_limits<double>::infinity());
    std::vector<size_t> cameFrom(graph_.nodeCount(), SIZE_MAX);
    std::unordered_set<size_t> closedSet;
    
    gScore[startNode] = 0;
    fScore[startNode] = heuristic(startNode, goalNode);
    openSet.push({fScore[startNode], startNode});
    
    while (!openSet.empty()) {
        auto [f, current] = openSet.top();
        openSet.pop();
        
        if (current == goalNode) {
            // Reconstruct path
            std::vector<size_t> path;
            for (size_t node = goalNode; node != SIZE_MAX; node = cameFrom[node]) {
                path.push_back(node);
            }
            std::reverse(path.begin(), path.end());
            return path;
        }
        
        if (closedSet.count(current)) continue;
        closedSet.insert(current);
        
        const RoadNode& node = graph_.node(current);
        
        for (size_t i = 0; i < node.neighbors.size(); ++i) {
            size_t neighbor = node.neighbors[i];
            if (closedSet.count(neighbor)) continue;
            
            double edgeCost = node.costs[i];
            
            // Apply penalties
            if (graph_.node(neighbor).roadId != node.roadId) {
                edgeCost += options.turnPenalty;
            }
            
            double tentativeG = gScore[current] + edgeCost;
            
            if (tentativeG < gScore[neighbor]) {
                cameFrom[neighbor] = current;
                gScore[neighbor] = tentativeG;
                fScore[neighbor] = tentativeG + heuristic(neighbor, goalNode);
                openSet.push({fScore[neighbor], neighbor});
            }
        }
    }
    
    return {};  // No path found
}

Route RoutePlanner::buildRoute(const std::vector<size_t>& nodePath) {
    Route route;
    
    if (nodePath.empty()) {
        route.valid = false;
        route.errorMessage = "No path found";
        return route;
    }
    
    route.valid = true;
    std::string lastRoadId;
    
    for (size_t nodeIdx : nodePath) {
        const RoadNode& node = graph_.node(nodeIdx);
        route.waypoints.push_back(node.position);
        
        if (node.roadId != lastRoadId) {
            route.roadIds.push_back(node.roadId);
            lastRoadId = node.roadId;
        }
    }
    
    // Calculate total length
    for (size_t i = 1; i < route.waypoints.size(); ++i) {
        route.totalLength += route.waypoints[i-1].distanceTo(route.waypoints[i]);
    }
    
    // Estimate time (simple calculation)
    // TODO: Use actual speed limits from road types
    double avgSpeed = 50.0;  // km/h
    route.estimatedTime = (route.totalLength / 1000.0) / avgSpeed * 3600.0;  // seconds
    
    return route;
}

Route RoutePlanner::planRoute(const Point2D& start, const Point2D& goal,
                             const RoutePlannerOptions& options) {
    int startNode = graph_.findNearestNode(start);
    int goalNode = graph_.findNearestNode(goal);
    
    if (startNode < 0 || goalNode < 0) {
        Route route;
        route.valid = false;
        route.errorMessage = "Could not find start or goal node";
        return route;
    }
    
    // Use A* for efficiency
    auto nodePath = astar(static_cast<size_t>(startNode), 
                          static_cast<size_t>(goalNode), options);
    
    return buildRoute(nodePath);
}

Route RoutePlanner::planRouteMulti(const std::vector<Point2D>& waypoints,
                                  const RoutePlannerOptions& options) {
    if (waypoints.size() < 2) {
        Route route;
        route.valid = false;
        route.errorMessage = "Need at least 2 waypoints";
        return route;
    }
    
    Route fullRoute;
    fullRoute.valid = true;
    
    for (size_t i = 1; i < waypoints.size(); ++i) {
        Route segment = planRoute(waypoints[i-1], waypoints[i], options);
        
        if (!segment.valid) {
            fullRoute.valid = false;
            fullRoute.errorMessage = "Failed at segment " + std::to_string(i);
            return fullRoute;
        }
        
        // Append segment (avoid duplicate point at junction)
        size_t startIdx = (i == 1) ? 0 : 1;
        for (size_t j = startIdx; j < segment.waypoints.size(); ++j) {
            fullRoute.waypoints.push_back(segment.waypoints[j]);
        }
        
        for (const auto& roadId : segment.roadIds) {
            if (fullRoute.roadIds.empty() || fullRoute.roadIds.back() != roadId) {
                fullRoute.roadIds.push_back(roadId);
            }
        }
        
        fullRoute.totalLength += segment.totalLength;
        fullRoute.estimatedTime += segment.estimatedTime;
    }
    
    return fullRoute;
}

std::vector<Point3D> RoutePlanner::findReachable(const Point2D& start, double maxDistance) {
    std::vector<Point3D> reachable;
    
    int startNode = graph_.findNearestNode(start);
    if (startNode < 0) return reachable;
    
    // BFS with distance limit
    std::vector<double> dist(graph_.nodeCount(), std::numeric_limits<double>::infinity());
    std::queue<size_t> queue;
    
    dist[startNode] = 0;
    queue.push(startNode);
    
    while (!queue.empty()) {
        size_t u = queue.front();
        queue.pop();
        
        reachable.push_back(graph_.node(u).position);
        
        const RoadNode& node = graph_.node(u);
        for (size_t i = 0; i < node.neighbors.size(); ++i) {
            size_t v = node.neighbors[i];
            double newDist = dist[u] + node.costs[i];
            
            if (newDist <= maxDistance && newDist < dist[v]) {
                dist[v] = newDist;
                queue.push(v);
            }
        }
    }
    
    return reachable;
}

// ============ Scenario Route Generator ============

ScenarioRouteGenerator::ScenarioRouteGenerator(const OpenDriveMap& map)
    : planner_(map), map_(map) {
}

Route ScenarioRouteGenerator::generateRandomRoute(double minLength, double maxLength) {
    if (map_.roads.empty()) {
        Route route;
        route.valid = false;
        route.errorMessage = "No roads in map";
        return route;
    }
    
    auto seed = std::chrono::system_clock::now().time_since_epoch().count();
    std::mt19937 rng(seed);
    
    // Try multiple times to find a valid route
    for (int attempt = 0; attempt < 10; ++attempt) {
        // Pick random start road
        size_t startRoadIdx = rng() % map_.roads.size();
        const Road& startRoad = map_.roads[startRoadIdx];
        
        // Pick random position on start road
        std::uniform_real_distribution<> dist(0, startRoad.length);
        double startS = dist(rng);
        
        Pose startPose = GeometryCalculator::getRoadPoseAt(startRoad, startS);
        Point2D startPt(startPose.position.x, startPose.position.y);
        
        // Pick random goal at target distance
        double targetDist = minLength + (maxLength - minLength) * (rng() % 100) / 100.0;
        
        // Find reachable points and pick one at appropriate distance
        auto reachable = planner_.findReachable(startPt, maxLength * 1.5);
        
        Point2D goalPt = startPt;
        double bestDistDiff = std::numeric_limits<double>::infinity();
        
        for (const auto& pt : reachable) {
            double dist = startPt.distanceTo(pt);
            double diff = std::abs(dist - targetDist);
            if (diff < bestDistDiff && dist > minLength * 0.5) {
                bestDistDiff = diff;
                goalPt = Point2D(pt.x, pt.y);
            }
        }
        
        Route route = planner_.planRoute(startPt, goalPt);
        
        if (route.valid && route.totalLength >= minLength && route.totalLength <= maxLength) {
            return route;
        }
    }
    
    Route failRoute;
    failRoute.valid = false;
    failRoute.errorMessage = "Could not generate route within length constraints";
    return failRoute;
}

Route ScenarioRouteGenerator::generateRouteWithTypes(const std::vector<RoadType>& requiredTypes,
                                                    double minLength) {
    // TODO: Implement type-aware route generation
    // For now, just generate a random route
    return generateRandomRoute(minLength, minLength * 2);
}

Route ScenarioRouteGenerator::generateRouteWithLaneChanges(int minLaneChanges, double length) {
    // TODO: Implement lane-change-aware route generation
    return generateRandomRoute(length * 0.8, length * 1.2);
}

}  // namespace opendrive
