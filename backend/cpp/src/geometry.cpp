#include "opendrive/geometry.hpp"
#include <cmath>
#include <algorithm>
#include <stdexcept>

namespace opendrive {

// ============ Fresnel Integrals (for clothoid) ============

void GeometryCalculator::fresnelIntegrals(double t, double& C, double& S) {
    // Approximate Fresnel integrals using series expansion
    // Valid for reasonable values of t
    const double pi = 3.14159265358979323846;
    const double piHalf = pi / 2.0;
    
    double x = std::abs(t);
    double x2 = x * x;
    
    if (x < 1.5) {
        // Use Taylor series for small x
        double sum_c = 0, sum_s = 0;
        double term_c = x;
        double term_s = x * x2 * piHalf / 3.0;
        
        for (int n = 0; n < 20; ++n) {
            sum_c += term_c;
            sum_s += term_s;
            
            term_c *= -piHalf * piHalf * x2 * x2 / ((4*n + 3) * (4*n + 4) * (2*n + 1) * (2*n + 2));
            term_s *= -piHalf * piHalf * x2 * x2 / ((4*n + 5) * (4*n + 6) * (2*n + 2) * (2*n + 3));
        }
        
        C = sum_c;
        S = sum_s;
    } else {
        // Use asymptotic expansion for large x
        double f = 1.0, g = 1.0 / (pi * x);
        double fn = 1.0, gn = 1.0;
        
        for (int n = 1; n < 10; ++n) {
            fn *= -(4*n - 3) * (4*n - 1) / (piHalf * piHalf * x2 * x2);
            gn *= -(4*n - 1) * (4*n + 1) / (piHalf * piHalf * x2 * x2);
            f += fn;
            g += gn / (pi * x);
        }
        
        double sinx = std::sin(piHalf * x2);
        double cosx = std::cos(piHalf * x2);
        
        C = 0.5 + f * sinx / (pi * x) - g * cosx;
        S = 0.5 - f * cosx / (pi * x) - g * sinx;
    }
    
    if (t < 0) {
        C = -C;
        S = -S;
    }
}

// ============ Geometry Position Calculations ============

Pose GeometryCalculator::linePosition(const Geometry& geom, double ds) {
    Pose pose;
    pose.position.x = geom.x + ds * std::cos(geom.hdg);
    pose.position.y = geom.y + ds * std::sin(geom.hdg);
    pose.position.z = 0;
    pose.heading = geom.hdg;
    return pose;
}

Pose GeometryCalculator::arcPosition(const Geometry& geom, double ds) {
    Pose pose;
    double curvature = geom.params.curvature;
    
    if (std::abs(curvature) < 1e-10) {
        // Nearly straight, treat as line
        return linePosition(geom, ds);
    }
    
    double radius = 1.0 / curvature;
    double angle = ds * curvature;
    
    // Local coordinates
    double localX = radius * std::sin(angle);
    double localY = radius * (1.0 - std::cos(angle));
    
    // Transform to global
    double cosHdg = std::cos(geom.hdg);
    double sinHdg = std::sin(geom.hdg);
    
    pose.position.x = geom.x + localX * cosHdg - localY * sinHdg;
    pose.position.y = geom.y + localX * sinHdg + localY * cosHdg;
    pose.position.z = 0;
    pose.heading = geom.hdg + angle;
    
    return pose;
}

Pose GeometryCalculator::spiralPosition(const Geometry& geom, double ds) {
    Pose pose;
    
    double curvStart = geom.params.curvStart;
    double curvEnd = geom.params.curvEnd;
    double length = geom.length;
    
    if (std::abs(curvEnd - curvStart) < 1e-10) {
        // Constant curvature, treat as arc
        Geometry arcGeom = geom;
        arcGeom.type = GeometryType::ARC;
        arcGeom.params.curvature = curvStart;
        return arcPosition(arcGeom, ds);
    }
    
    // Clothoid parameter A
    double dCurv = (curvEnd - curvStart) / length;
    
    // Compute position using Fresnel integrals
    // The clothoid is parameterized by arc length s
    // curvature(s) = curvStart + dCurv * s
    
    double sqrtA = std::sqrt(std::abs(dCurv) / 3.14159265358979);
    double tau = curvStart / dCurv;  // Initial s offset
    
    double t1 = sqrtA * (ds + tau);
    double t0 = sqrtA * tau;
    
    double C1, S1, C0, S0;
    fresnelIntegrals(t1, C1, S1);
    fresnelIntegrals(t0, C0, S0);
    
    double scale = std::sqrt(3.14159265358979 / std::abs(dCurv));
    
    double localX, localY;
    if (dCurv > 0) {
        localX = scale * (C1 - C0);
        localY = scale * (S1 - S0);
    } else {
        localX = scale * (C1 - C0);
        localY = -scale * (S1 - S0);
    }
    
    // Transform to global
    double cosHdg = std::cos(geom.hdg);
    double sinHdg = std::sin(geom.hdg);
    
    pose.position.x = geom.x + localX * cosHdg - localY * sinHdg;
    pose.position.y = geom.y + localX * sinHdg + localY * cosHdg;
    pose.position.z = 0;
    
    // Heading at ds
    pose.heading = geom.hdg + curvStart * ds + 0.5 * dCurv * ds * ds;
    
    return pose;
}

Pose GeometryCalculator::poly3Position(const Geometry& geom, double ds) {
    Pose pose;
    
    double u = ds;
    double v = geom.params.a + geom.params.b * u + 
               geom.params.c * u * u + geom.params.d * u * u * u;
    
    // Derivative for heading
    double dv = geom.params.b + 2 * geom.params.c * u + 3 * geom.params.d * u * u;
    
    // Transform to global
    double cosHdg = std::cos(geom.hdg);
    double sinHdg = std::sin(geom.hdg);
    
    pose.position.x = geom.x + u * cosHdg - v * sinHdg;
    pose.position.y = geom.y + u * sinHdg + v * cosHdg;
    pose.position.z = 0;
    pose.heading = geom.hdg + std::atan(dv);
    
    return pose;
}

Pose GeometryCalculator::paramPoly3Position(const Geometry& geom, double ds) {
    Pose pose;
    
    // Normalize parameter
    double p;
    if (geom.params.pRange_normalized) {
        p = ds / geom.length;  // [0, 1]
    } else {
        p = ds;  // [0, length]
    }
    
    double p2 = p * p;
    double p3 = p2 * p;
    
    // Local coordinates
    double u = geom.params.aU + geom.params.bU * p + 
               geom.params.cU * p2 + geom.params.dU * p3;
    double v = geom.params.aV + geom.params.bV * p + 
               geom.params.cV * p2 + geom.params.dV * p3;
    
    // Derivatives for heading
    double du = geom.params.bU + 2 * geom.params.cU * p + 3 * geom.params.dU * p2;
    double dv = geom.params.bV + 2 * geom.params.cV * p + 3 * geom.params.dV * p2;
    
    // Transform to global
    double cosHdg = std::cos(geom.hdg);
    double sinHdg = std::sin(geom.hdg);
    
    pose.position.x = geom.x + u * cosHdg - v * sinHdg;
    pose.position.y = geom.y + u * sinHdg + v * cosHdg;
    pose.position.z = 0;
    pose.heading = geom.hdg + std::atan2(dv, du);
    
    return pose;
}

// ============ Public Methods ============

Pose GeometryCalculator::getPoseAt(const Geometry& geom, double ds) {
    ds = std::clamp(ds, 0.0, geom.length);
    
    switch (geom.type) {
        case GeometryType::LINE:
            return linePosition(geom, ds);
        case GeometryType::ARC:
            return arcPosition(geom, ds);
        case GeometryType::SPIRAL:
            return spiralPosition(geom, ds);
        case GeometryType::POLY3:
            return poly3Position(geom, ds);
        case GeometryType::PARAM_POLY3:
            return paramPoly3Position(geom, ds);
        default:
            return linePosition(geom, ds);
    }
}

std::vector<Point3D> GeometryCalculator::sampleGeometry(const Geometry& geom, double resolution) {
    std::vector<Point3D> points;
    
    int numSamples = std::max(2, static_cast<int>(geom.length / resolution) + 1);
    double step = geom.length / (numSamples - 1);
    
    for (int i = 0; i < numSamples; ++i) {
        double ds = i * step;
        Pose pose = getPoseAt(geom, ds);
        points.push_back(pose.position);
    }
    
    return points;
}

Pose GeometryCalculator::getRoadPoseAt(const Road& road, double s) {
    s = std::clamp(s, 0.0, road.length);
    
    // Find geometry segment containing s
    const Geometry* active = nullptr;
    for (const auto& geom : road.planView) {
        if (geom.s <= s && s <= geom.s + geom.length) {
            active = &geom;
            break;
        }
        if (geom.s > s) break;
        active = &geom;
    }
    
    if (!active) {
        throw std::runtime_error("No geometry found at s=" + std::to_string(s));
    }
    
    double ds = s - active->s;
    return getPoseAt(*active, ds);
}

std::vector<Point3D> GeometryCalculator::sampleRoad(const Road& road, double resolution) {
    std::vector<Point3D> points;
    
    for (const auto& geom : road.planView) {
        auto geomPoints = sampleGeometry(geom, resolution);
        
        // Avoid duplicate points at segment boundaries
        if (!points.empty() && !geomPoints.empty()) {
            geomPoints.erase(geomPoints.begin());
        }
        
        points.insert(points.end(), geomPoints.begin(), geomPoints.end());
    }
    
    return points;
}

std::vector<Point3D> GeometryCalculator::sampleLaneBoundary(const Road& road, int laneId, double resolution) {
    std::vector<Point3D> boundary;
    
    int numSamples = std::max(2, static_cast<int>(road.length / resolution) + 1);
    double step = road.length / (numSamples - 1);
    
    for (int i = 0; i < numSamples; ++i) {
        double s = i * step;
        Pose refPose = getRoadPoseAt(road, s);
        
        // Get lane section at this s
        const LaneSection* section = road.getLaneSectionAt(s);
        if (!section) continue;
        
        // Calculate lateral offset to lane boundary
        double offset = 0;
        double sLocal = s - section->s;
        
        if (laneId > 0) {
            // Left lanes: sum widths from center to target lane
            for (int id = 1; id <= laneId; ++id) {
                const Lane* lane = section->getLane(id);
                if (lane) offset += lane->getWidth(sLocal);
            }
        } else if (laneId < 0) {
            // Right lanes: negative offset
            for (int id = -1; id >= laneId; --id) {
                const Lane* lane = section->getLane(id);
                if (lane) offset -= lane->getWidth(sLocal);
            }
        }
        
        // Apply lateral offset perpendicular to heading
        Point3D pt;
        pt.x = refPose.position.x - offset * std::sin(refPose.heading);
        pt.y = refPose.position.y + offset * std::cos(refPose.heading);
        pt.z = 0;
        
        boundary.push_back(pt);
    }
    
    return boundary;
}

std::vector<Point3D> GeometryCalculator::sampleLaneCenter(const Road& road, int laneId, double resolution) {
    std::vector<Point3D> centerLine;
    
    int numSamples = std::max(2, static_cast<int>(road.length / resolution) + 1);
    double step = road.length / (numSamples - 1);
    
    for (int i = 0; i < numSamples; ++i) {
        double s = i * step;
        Pose refPose = getRoadPoseAt(road, s);
        
        const LaneSection* section = road.getLaneSectionAt(s);
        if (!section) continue;
        
        double sLocal = s - section->s;
        
        // Calculate offset to lane center
        double offset = 0;
        
        if (laneId > 0) {
            // Sum widths of lanes closer to center, plus half of target lane
            for (int id = 1; id < laneId; ++id) {
                const Lane* lane = section->getLane(id);
                if (lane) offset += lane->getWidth(sLocal);
            }
            const Lane* targetLane = section->getLane(laneId);
            if (targetLane) offset += targetLane->getWidth(sLocal) / 2.0;
        } else if (laneId < 0) {
            for (int id = -1; id > laneId; --id) {
                const Lane* lane = section->getLane(id);
                if (lane) offset -= lane->getWidth(sLocal);
            }
            const Lane* targetLane = section->getLane(laneId);
            if (targetLane) offset -= targetLane->getWidth(sLocal) / 2.0;
        }
        
        Point3D pt;
        pt.x = refPose.position.x - offset * std::sin(refPose.heading);
        pt.y = refPose.position.y + offset * std::cos(refPose.heading);
        pt.z = 0;
        
        centerLine.push_back(pt);
    }
    
    return centerLine;
}

// ============ Road Graph ============

void RoadGraph::buildFromMap(const OpenDriveMap& map, double resolution) {
    nodes_.clear();
    
    // Create nodes along each road
    std::unordered_map<std::string, std::vector<size_t>> roadNodes;
    
    for (const auto& road : map.roads) {
        std::vector<size_t> nodeIndices;
        
        int numNodes = std::max(2, static_cast<int>(road.length / resolution) + 1);
        double step = road.length / (numNodes - 1);
        
        for (int i = 0; i < numNodes; ++i) {
            double s = i * step;
            Pose pose = GeometryCalculator::getRoadPoseAt(road, s);
            
            RoadNode node;
            node.roadId = road.id;
            node.s = s;
            node.position = pose.position;
            
            nodeIndices.push_back(nodes_.size());
            nodes_.push_back(node);
        }
        
        roadNodes[road.id] = nodeIndices;
        
        // Connect sequential nodes on same road
        for (size_t i = 1; i < nodeIndices.size(); ++i) {
            size_t prev = nodeIndices[i - 1];
            size_t curr = nodeIndices[i];
            
            double dist = nodes_[prev].position.distanceTo(nodes_[curr].position);
            
            nodes_[prev].neighbors.push_back(curr);
            nodes_[prev].costs.push_back(dist);
            
            // Bidirectional for now
            nodes_[curr].neighbors.push_back(prev);
            nodes_[curr].costs.push_back(dist);
        }
    }
    
    // Connect roads at junctions
    for (const auto& junction : map.junctions) {
        for (const auto& conn : junction.connections) {
            auto inIt = roadNodes.find(conn.incomingRoad);
            auto connIt = roadNodes.find(conn.connectingRoad);
            
            if (inIt == roadNodes.end() || connIt == roadNodes.end()) continue;
            
            // Connect end of incoming to start of connecting
            size_t inNode = inIt->second.back();
            size_t connNode = connIt->second.front();
            
            double dist = nodes_[inNode].position.distanceTo(nodes_[connNode].position);
            
            nodes_[inNode].neighbors.push_back(connNode);
            nodes_[inNode].costs.push_back(dist);
        }
    }
}

int RoadGraph::findNearestNode(const Point2D& pos) const {
    if (nodes_.empty()) return -1;
    
    int nearest = 0;
    double minDist = pos.distanceTo(nodes_[0].position);
    
    for (size_t i = 1; i < nodes_.size(); ++i) {
        double dist = pos.distanceTo(nodes_[i].position);
        if (dist < minDist) {
            minDist = dist;
            nearest = static_cast<int>(i);
        }
    }
    
    return nearest;
}

// ============ Road Pose Implementation ============

Pose Road::getPoseAt(double s) const {
    return GeometryCalculator::getRoadPoseAt(*this, s);
}

}  // namespace opendrive
