#pragma once

#include <string>
#include <vector>
#include <memory>
#include <optional>
#include <cmath>

namespace opendrive {

// ============ Basic Types ============

struct Point2D {
    double x = 0.0;
    double y = 0.0;
    
    Point2D() = default;
    Point2D(double x_, double y_) : x(x_), y(y_) {}
    
    double distanceTo(const Point2D& other) const {
        double dx = other.x - x;
        double dy = other.y - y;
        return std::sqrt(dx * dx + dy * dy);
    }
};

struct Point3D : public Point2D {
    double z = 0.0;
    
    Point3D() = default;
    Point3D(double x_, double y_, double z_ = 0.0) : Point2D(x_, y_), z(z_) {}
};

struct Pose {
    Point3D position;
    double heading = 0.0;  // radians
    double pitch = 0.0;
    double roll = 0.0;
};

// ============ Geometry Types ============

enum class GeometryType {
    LINE,
    ARC,
    SPIRAL,      // Clothoid/Euler spiral
    POLY3,       // Cubic polynomial
    PARAM_POLY3  // Parametric cubic polynomial
};

struct GeometryParams {
    // Line: no additional params
    
    // Arc
    double curvature = 0.0;
    
    // Spiral (Clothoid)
    double curvStart = 0.0;
    double curvEnd = 0.0;
    
    // Poly3: a + b*u + c*u^2 + d*u^3
    double a = 0.0, b = 0.0, c = 0.0, d = 0.0;
    
    // ParamPoly3
    double aU = 0.0, bU = 0.0, cU = 0.0, dU = 0.0;
    double aV = 0.0, bV = 0.0, cV = 0.0, dV = 0.0;
    bool pRange_normalized = true;  // true = [0,1], false = [0,length]
};

struct Geometry {
    double s = 0.0;          // s-coordinate start
    double x = 0.0;          // start x
    double y = 0.0;          // start y
    double hdg = 0.0;        // start heading (radians)
    double length = 0.0;     // length in meters
    GeometryType type = GeometryType::LINE;
    GeometryParams params;
};

// ============ Lane Types ============

enum class LaneType {
    NONE,
    DRIVING,
    STOP,
    SHOULDER,
    BIKING,
    SIDEWALK,
    BORDER,
    RESTRICTED,
    PARKING,
    BIDIRECTIONAL,
    MEDIAN,
    SPECIAL1,
    SPECIAL2,
    SPECIAL3,
    ROAD_WORKS,
    TRAM,
    RAIL,
    ENTRY,
    EXIT,
    OFF_RAMP,
    ON_RAMP
};

struct LaneWidth {
    double sOffset = 0.0;
    double a = 0.0, b = 0.0, c = 0.0, d = 0.0;  // polynomial coefficients
    
    double getWidth(double ds) const {
        return a + b * ds + c * ds * ds + d * ds * ds * ds;
    }
};

struct Lane {
    int id = 0;
    LaneType type = LaneType::NONE;
    std::string level;
    std::vector<LaneWidth> widths;
    std::optional<int> predecessorId;
    std::optional<int> successorId;
    
    double getWidth(double sOffset) const {
        if (widths.empty()) return 0.0;
        
        // Find applicable width entry
        const LaneWidth* active = &widths[0];
        for (const auto& w : widths) {
            if (w.sOffset <= sOffset) active = &w;
            else break;
        }
        return active->getWidth(sOffset - active->sOffset);
    }
};

struct LaneSection {
    double s = 0.0;
    std::vector<Lane> leftLanes;   // positive IDs (1, 2, 3...)
    Lane centerLane;               // ID = 0
    std::vector<Lane> rightLanes;  // negative IDs (-1, -2, -3...)
    
    const Lane* getLane(int id) const {
        if (id == 0) return &centerLane;
        if (id > 0) {
            for (const auto& lane : leftLanes) {
                if (lane.id == id) return &lane;
            }
        } else {
            for (const auto& lane : rightLanes) {
                if (lane.id == id) return &lane;
            }
        }
        return nullptr;
    }
};

// ============ Signal/Sign Types ============

enum class SignalType {
    UNKNOWN,
    SPEED_LIMIT,
    STOP,
    YIELD,
    TRAFFIC_LIGHT,
    WARNING,
    REGULATORY,
    GUIDE
};

struct Signal {
    std::string id;
    double s = 0.0;
    double t = 0.0;
    std::string name;
    std::string type;
    std::string subtype;
    double value = 0.0;      // e.g., speed limit value
    std::string unit;
    double hOffset = 0.0;
    double pitch = 0.0;
    double roll = 0.0;
    std::string orientation; // "+" or "-"
    bool dynamic = false;
    
    SignalType getSignalType() const;
};

// ============ Road Types ============

enum class RoadType {
    UNKNOWN,
    RURAL,
    MOTORWAY,
    TOWN,
    LOW_SPEED,
    PEDESTRIAN,
    BICYCLE
};

struct RoadTypeEntry {
    double s = 0.0;
    RoadType type = RoadType::UNKNOWN;
    double maxSpeed = -1.0;  // -1 = no limit specified
    std::string unit = "km/h";
};

// ============ Road Link ============

struct RoadLink {
    enum class Type { ROAD, JUNCTION };
    enum class ContactPoint { START, END };
    
    std::string elementId;
    Type elementType = Type::ROAD;
    std::optional<ContactPoint> contactPoint;
};

struct RoadLinks {
    std::optional<RoadLink> predecessor;
    std::optional<RoadLink> successor;
};

// ============ Junction ============

struct JunctionConnection {
    std::string id;
    std::string incomingRoad;
    std::string connectingRoad;
    std::string contactPoint;
    std::vector<std::pair<int, int>> laneLinkFrom;  // from lane -> to lane
};

struct Junction {
    std::string id;
    std::string name;
    std::vector<JunctionConnection> connections;
};

// ============ Road ============

struct Road {
    std::string id;
    std::string name;
    double length = 0.0;
    std::string junctionId;  // "-1" if not in junction
    
    RoadLinks links;
    std::vector<RoadTypeEntry> types;
    std::vector<Geometry> planView;  // reference line geometry
    std::vector<LaneSection> laneSections;
    std::vector<Signal> signals;
    
    // Get position on reference line at s-coordinate
    Pose getPoseAt(double s) const;
    
    // Get lane section at s-coordinate
    const LaneSection* getLaneSectionAt(double s) const;
    
    // Check if road is in a junction
    bool isInJunction() const { return junctionId != "-1" && !junctionId.empty(); }
};

// ============ OpenDRIVE Map ============

struct OpenDriveMap {
    std::string name;
    std::string version;
    std::string date;
    
    std::vector<Road> roads;
    std::vector<Junction> junctions;
    
    // Lookup helpers
    const Road* getRoad(const std::string& id) const;
    const Junction* getJunction(const std::string& id) const;
    
    // Statistics
    size_t totalRoadLength() const;
    size_t totalLaneCount() const;
    size_t totalSignalCount() const;
};

}  // namespace opendrive
