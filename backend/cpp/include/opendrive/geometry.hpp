#pragma once

#include "types.hpp"
#include <vector>

namespace opendrive {

/**
 * Geometry Calculator
 * 
 * Computes positions along various geometry types:
 * - Line: straight segments
 * - Arc: constant curvature
 * - Spiral: clothoid/Euler spiral (linearly varying curvature)
 * - Poly3: cubic polynomial
 * - ParamPoly3: parametric cubic polynomial
 */
class GeometryCalculator {
public:
    /**
     * Sample points along a geometry segment
     * @param geom Geometry definition
     * @param resolution Distance between samples in meters
     * @return Vector of sampled points
     */
    static std::vector<Point3D> sampleGeometry(const Geometry& geom, double resolution = 1.0);
    
    /**
     * Get pose at specific s-offset within geometry
     * @param geom Geometry definition
     * @param ds Offset from geometry start (0 to geom.length)
     * @return Position and heading at offset
     */
    static Pose getPoseAt(const Geometry& geom, double ds);
    
    /**
     * Sample entire road reference line
     * @param road Road with planView geometries
     * @param resolution Distance between samples
     * @return Vector of sampled points
     */
    static std::vector<Point3D> sampleRoad(const Road& road, double resolution = 1.0);
    
    /**
     * Get pose on road at s-coordinate
     * @param road Road definition
     * @param s S-coordinate along road
     * @return Position and heading
     */
    static Pose getRoadPoseAt(const Road& road, double s);
    
    /**
     * Sample lane boundaries
     * @param road Road definition
     * @param laneId Lane ID (negative = right, positive = left)
     * @param resolution Sample resolution
     * @return Vector of boundary points
     */
    static std::vector<Point3D> sampleLaneBoundary(const Road& road, int laneId, double resolution = 1.0);
    
    /**
     * Sample lane center line
     * @param road Road definition
     * @param laneId Lane ID
     * @param resolution Sample resolution
     * @return Vector of center line points
     */
    static std::vector<Point3D> sampleLaneCenter(const Road& road, int laneId, double resolution = 1.0);

private:
    // Fresnel integrals for clothoid calculation
    static void fresnelIntegrals(double t, double& C, double& S);
    
    // Line geometry
    static Pose linePosition(const Geometry& geom, double ds);
    
    // Arc geometry
    static Pose arcPosition(const Geometry& geom, double ds);
    
    // Spiral (clothoid) geometry
    static Pose spiralPosition(const Geometry& geom, double ds);
    
    // Poly3 geometry
    static Pose poly3Position(const Geometry& geom, double ds);
    
    // ParamPoly3 geometry
    static Pose paramPoly3Position(const Geometry& geom, double ds);
};

/**
 * Road Network Graph
 * 
 * Builds a graph representation of the road network for routing.
 */
struct RoadNode {
    std::string roadId;
    double s;
    Point3D position;
    std::vector<size_t> neighbors;  // indices into graph nodes
    std::vector<double> costs;      // edge costs to neighbors
};

class RoadGraph {
public:
    /**
     * Build graph from OpenDRIVE map
     * @param map Parsed OpenDRIVE map
     * @param resolution Node spacing in meters
     */
    void buildFromMap(const OpenDriveMap& map, double resolution = 10.0);
    
    /**
     * Find nearest node to position
     * @param pos Query position
     * @return Node index, or -1 if not found
     */
    int findNearestNode(const Point2D& pos) const;
    
    /**
     * Get all nodes
     */
    const std::vector<RoadNode>& nodes() const { return nodes_; }
    
    /**
     * Get node by index
     */
    const RoadNode& node(size_t idx) const { return nodes_[idx]; }
    
    size_t nodeCount() const { return nodes_.size(); }

private:
    std::vector<RoadNode> nodes_;
    void connectNodes();
};

}  // namespace opendrive
