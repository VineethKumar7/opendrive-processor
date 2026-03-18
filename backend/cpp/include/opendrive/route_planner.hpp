#pragma once

#include "types.hpp"
#include "geometry.hpp"
#include <vector>
#include <functional>

namespace opendrive {

/**
 * Route Planning Result
 */
struct Route {
    std::vector<Point3D> waypoints;
    std::vector<std::string> roadIds;    // roads traversed
    std::vector<int> laneIds;            // lanes used
    double totalLength = 0.0;
    double estimatedTime = 0.0;          // seconds at speed limit
    bool valid = false;
    std::string errorMessage;
};

/**
 * Route Planning Options
 */
struct RoutePlannerOptions {
    bool preferHighways = false;
    bool avoidUTurns = true;
    double maxSpeed = 130.0;             // km/h for time estimation
    double laneChangePenalty = 5.0;      // meters added for lane changes
    double turnPenalty = 10.0;           // meters added for turns
};

/**
 * Route Planner
 * 
 * Implements route planning algorithms on OpenDRIVE road networks:
 * - Dijkstra's algorithm for shortest path
 * - A* with Euclidean heuristic for faster planning
 */
class RoutePlanner {
public:
    /**
     * Initialize planner with road network
     * @param map Parsed OpenDRIVE map
     * @param graphResolution Node spacing for graph (meters)
     */
    explicit RoutePlanner(const OpenDriveMap& map, double graphResolution = 10.0);
    
    /**
     * Plan route between two points
     * @param start Start position
     * @param goal Goal position
     * @param options Planning options
     * @return Planned route
     */
    Route planRoute(const Point2D& start, const Point2D& goal, 
                   const RoutePlannerOptions& options = {});
    
    /**
     * Plan route through multiple waypoints
     * @param waypoints List of waypoints to visit
     * @param options Planning options
     * @return Planned route
     */
    Route planRouteMulti(const std::vector<Point2D>& waypoints,
                        const RoutePlannerOptions& options = {});
    
    /**
     * Find all reachable positions from start within distance
     * @param start Start position
     * @param maxDistance Maximum travel distance
     * @return Vector of reachable positions
     */
    std::vector<Point3D> findReachable(const Point2D& start, double maxDistance);
    
    /**
     * Get the internal road graph
     */
    const RoadGraph& graph() const { return graph_; }

private:
    const OpenDriveMap& map_;
    RoadGraph graph_;
    
    // Dijkstra's algorithm
    std::vector<size_t> dijkstra(size_t startNode, size_t goalNode,
                                 const RoutePlannerOptions& options);
    
    // A* algorithm
    std::vector<size_t> astar(size_t startNode, size_t goalNode,
                             const RoutePlannerOptions& options);
    
    // Heuristic function for A*
    double heuristic(size_t nodeA, size_t nodeB) const;
    
    // Convert node path to route
    Route buildRoute(const std::vector<size_t>& nodePath);
};

/**
 * Scenario Route Generator
 * 
 * Generates routes suitable for simulation scenarios.
 */
class ScenarioRouteGenerator {
public:
    explicit ScenarioRouteGenerator(const OpenDriveMap& map);
    
    /**
     * Generate a random valid route
     * @param minLength Minimum route length in meters
     * @param maxLength Maximum route length in meters
     * @return Generated route
     */
    Route generateRandomRoute(double minLength, double maxLength);
    
    /**
     * Generate route that passes through specific road types
     * @param requiredTypes Road types that must be included
     * @param minLength Minimum length
     * @return Generated route
     */
    Route generateRouteWithTypes(const std::vector<RoadType>& requiredTypes,
                                double minLength);
    
    /**
     * Generate route with lane changes
     * @param minLaneChanges Minimum number of lane changes
     * @param length Approximate route length
     * @return Generated route with lane change points
     */
    Route generateRouteWithLaneChanges(int minLaneChanges, double length);

private:
    RoutePlanner planner_;
    const OpenDriveMap& map_;
};

}  // namespace opendrive
