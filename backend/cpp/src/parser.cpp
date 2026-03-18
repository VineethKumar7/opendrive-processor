#include "opendrive/parser.hpp"
#include "opendrive/types.hpp"
#include <tinyxml2.h>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <unordered_map>

namespace opendrive {

using namespace tinyxml2;

// ============ Helper Functions ============

static std::string getAttrStr(const XMLElement* elem, const char* name, const std::string& def = "") {
    const char* val = elem->Attribute(name);
    return val ? val : def;
}

static double getAttrDouble(const XMLElement* elem, const char* name, double def = 0.0) {
    double val = def;
    elem->QueryDoubleAttribute(name, &val);
    return val;
}

static int getAttrInt(const XMLElement* elem, const char* name, int def = 0) {
    int val = def;
    elem->QueryIntAttribute(name, &val);
    return val;
}

static LaneType parseLaneType(const std::string& str) {
    static const std::unordered_map<std::string, LaneType> types = {
        {"none", LaneType::NONE},
        {"driving", LaneType::DRIVING},
        {"stop", LaneType::STOP},
        {"shoulder", LaneType::SHOULDER},
        {"biking", LaneType::BIKING},
        {"sidewalk", LaneType::SIDEWALK},
        {"border", LaneType::BORDER},
        {"restricted", LaneType::RESTRICTED},
        {"parking", LaneType::PARKING},
        {"bidirectional", LaneType::BIDIRECTIONAL},
        {"median", LaneType::MEDIAN},
        {"special1", LaneType::SPECIAL1},
        {"special2", LaneType::SPECIAL2},
        {"special3", LaneType::SPECIAL3},
        {"roadWorks", LaneType::ROAD_WORKS},
        {"tram", LaneType::TRAM},
        {"rail", LaneType::RAIL},
        {"entry", LaneType::ENTRY},
        {"exit", LaneType::EXIT},
        {"offRamp", LaneType::OFF_RAMP},
        {"onRamp", LaneType::ON_RAMP}
    };
    auto it = types.find(str);
    return it != types.end() ? it->second : LaneType::NONE;
}

static RoadType parseRoadType(const std::string& str) {
    static const std::unordered_map<std::string, RoadType> types = {
        {"unknown", RoadType::UNKNOWN},
        {"rural", RoadType::RURAL},
        {"motorway", RoadType::MOTORWAY},
        {"town", RoadType::TOWN},
        {"lowSpeed", RoadType::LOW_SPEED},
        {"pedestrian", RoadType::PEDESTRIAN},
        {"bicycle", RoadType::BICYCLE}
    };
    auto it = types.find(str);
    return it != types.end() ? it->second : RoadType::UNKNOWN;
}

static GeometryType parseGeometryType(const std::string& str) {
    if (str == "line") return GeometryType::LINE;
    if (str == "arc") return GeometryType::ARC;
    if (str == "spiral") return GeometryType::SPIRAL;
    if (str == "poly3") return GeometryType::POLY3;
    if (str == "paramPoly3") return GeometryType::PARAM_POLY3;
    return GeometryType::LINE;
}

// ============ Parser Implementation ============

class Parser::Impl {
public:
    OpenDriveMap parse(XMLDocument& doc) {
        OpenDriveMap map;
        
        XMLElement* root = doc.FirstChildElement("OpenDRIVE");
        if (!root) {
            throw ParseException("Missing OpenDRIVE root element");
        }
        
        // Parse header
        if (XMLElement* header = root->FirstChildElement("header")) {
            map.name = getAttrStr(header, "name");
            map.version = getAttrStr(header, "revMajor") + "." + 
                         getAttrStr(header, "revMinor");
            map.date = getAttrStr(header, "date");
        }
        
        // Parse roads
        for (XMLElement* roadElem = root->FirstChildElement("road"); 
             roadElem; 
             roadElem = roadElem->NextSiblingElement("road")) {
            map.roads.push_back(parseRoad(roadElem));
        }
        
        // Parse junctions
        for (XMLElement* juncElem = root->FirstChildElement("junction");
             juncElem;
             juncElem = juncElem->NextSiblingElement("junction")) {
            map.junctions.push_back(parseJunction(juncElem));
        }
        
        return map;
    }
    
private:
    Road parseRoad(XMLElement* elem) {
        Road road;
        road.id = getAttrStr(elem, "id");
        road.name = getAttrStr(elem, "name");
        road.length = getAttrDouble(elem, "length");
        road.junctionId = getAttrStr(elem, "junction", "-1");
        
        // Parse link
        if (XMLElement* link = elem->FirstChildElement("link")) {
            road.links = parseRoadLinks(link);
        }
        
        // Parse type entries
        for (XMLElement* typeElem = elem->FirstChildElement("type");
             typeElem;
             typeElem = typeElem->NextSiblingElement("type")) {
            road.types.push_back(parseRoadType(typeElem));
        }
        
        // Parse planView (reference line geometry)
        if (XMLElement* planView = elem->FirstChildElement("planView")) {
            for (XMLElement* geomElem = planView->FirstChildElement("geometry");
                 geomElem;
                 geomElem = geomElem->NextSiblingElement("geometry")) {
                road.planView.push_back(parseGeometry(geomElem));
            }
        }
        
        // Parse lanes
        if (XMLElement* lanes = elem->FirstChildElement("lanes")) {
            for (XMLElement* lsElem = lanes->FirstChildElement("laneSection");
                 lsElem;
                 lsElem = lsElem->NextSiblingElement("laneSection")) {
                road.laneSections.push_back(parseLaneSection(lsElem));
            }
        }
        
        // Parse signals
        if (XMLElement* signals = elem->FirstChildElement("signals")) {
            for (XMLElement* sigElem = signals->FirstChildElement("signal");
                 sigElem;
                 sigElem = sigElem->NextSiblingElement("signal")) {
                road.signals.push_back(parseSignal(sigElem));
            }
        }
        
        return road;
    }
    
    RoadLinks parseRoadLinks(XMLElement* elem) {
        RoadLinks links;
        
        if (XMLElement* pred = elem->FirstChildElement("predecessor")) {
            RoadLink link;
            link.elementId = getAttrStr(pred, "elementId");
            std::string type = getAttrStr(pred, "elementType", "road");
            link.elementType = (type == "junction") ? 
                RoadLink::Type::JUNCTION : RoadLink::Type::ROAD;
            std::string cp = getAttrStr(pred, "contactPoint");
            if (!cp.empty()) {
                link.contactPoint = (cp == "start") ? 
                    RoadLink::ContactPoint::START : RoadLink::ContactPoint::END;
            }
            links.predecessor = link;
        }
        
        if (XMLElement* succ = elem->FirstChildElement("successor")) {
            RoadLink link;
            link.elementId = getAttrStr(succ, "elementId");
            std::string type = getAttrStr(succ, "elementType", "road");
            link.elementType = (type == "junction") ? 
                RoadLink::Type::JUNCTION : RoadLink::Type::ROAD;
            std::string cp = getAttrStr(succ, "contactPoint");
            if (!cp.empty()) {
                link.contactPoint = (cp == "start") ? 
                    RoadLink::ContactPoint::START : RoadLink::ContactPoint::END;
            }
            links.successor = link;
        }
        
        return links;
    }
    
    RoadTypeEntry parseRoadType(XMLElement* elem) {
        RoadTypeEntry entry;
        entry.s = getAttrDouble(elem, "s");
        entry.type = opendrive::parseRoadType(getAttrStr(elem, "type"));
        
        if (XMLElement* speed = elem->FirstChildElement("speed")) {
            entry.maxSpeed = getAttrDouble(speed, "max", -1.0);
            entry.unit = getAttrStr(speed, "unit", "km/h");
        }
        
        return entry;
    }
    
    Geometry parseGeometry(XMLElement* elem) {
        Geometry geom;
        geom.s = getAttrDouble(elem, "s");
        geom.x = getAttrDouble(elem, "x");
        geom.y = getAttrDouble(elem, "y");
        geom.hdg = getAttrDouble(elem, "hdg");
        geom.length = getAttrDouble(elem, "length");
        
        // Determine geometry type from child element
        if (elem->FirstChildElement("line")) {
            geom.type = GeometryType::LINE;
        }
        else if (XMLElement* arc = elem->FirstChildElement("arc")) {
            geom.type = GeometryType::ARC;
            geom.params.curvature = getAttrDouble(arc, "curvature");
        }
        else if (XMLElement* spiral = elem->FirstChildElement("spiral")) {
            geom.type = GeometryType::SPIRAL;
            geom.params.curvStart = getAttrDouble(spiral, "curvStart");
            geom.params.curvEnd = getAttrDouble(spiral, "curvEnd");
        }
        else if (XMLElement* poly3 = elem->FirstChildElement("poly3")) {
            geom.type = GeometryType::POLY3;
            geom.params.a = getAttrDouble(poly3, "a");
            geom.params.b = getAttrDouble(poly3, "b");
            geom.params.c = getAttrDouble(poly3, "c");
            geom.params.d = getAttrDouble(poly3, "d");
        }
        else if (XMLElement* pp3 = elem->FirstChildElement("paramPoly3")) {
            geom.type = GeometryType::PARAM_POLY3;
            geom.params.aU = getAttrDouble(pp3, "aU");
            geom.params.bU = getAttrDouble(pp3, "bU");
            geom.params.cU = getAttrDouble(pp3, "cU");
            geom.params.dU = getAttrDouble(pp3, "dU");
            geom.params.aV = getAttrDouble(pp3, "aV");
            geom.params.bV = getAttrDouble(pp3, "bV");
            geom.params.cV = getAttrDouble(pp3, "cV");
            geom.params.dV = getAttrDouble(pp3, "dV");
            std::string pRange = getAttrStr(pp3, "pRange", "normalized");
            geom.params.pRange_normalized = (pRange == "normalized");
        }
        
        return geom;
    }
    
    LaneSection parseLaneSection(XMLElement* elem) {
        LaneSection section;
        section.s = getAttrDouble(elem, "s");
        
        // Parse left lanes
        if (XMLElement* left = elem->FirstChildElement("left")) {
            for (XMLElement* laneElem = left->FirstChildElement("lane");
                 laneElem;
                 laneElem = laneElem->NextSiblingElement("lane")) {
                section.leftLanes.push_back(parseLane(laneElem));
            }
            // Sort by ID (ascending for left lanes)
            std::sort(section.leftLanes.begin(), section.leftLanes.end(),
                     [](const Lane& a, const Lane& b) { return a.id < b.id; });
        }
        
        // Parse center lane
        if (XMLElement* center = elem->FirstChildElement("center")) {
            if (XMLElement* laneElem = center->FirstChildElement("lane")) {
                section.centerLane = parseLane(laneElem);
            }
        }
        
        // Parse right lanes
        if (XMLElement* right = elem->FirstChildElement("right")) {
            for (XMLElement* laneElem = right->FirstChildElement("lane");
                 laneElem;
                 laneElem = laneElem->NextSiblingElement("lane")) {
                section.rightLanes.push_back(parseLane(laneElem));
            }
            // Sort by ID (descending for right lanes, -1 before -2)
            std::sort(section.rightLanes.begin(), section.rightLanes.end(),
                     [](const Lane& a, const Lane& b) { return a.id > b.id; });
        }
        
        return section;
    }
    
    Lane parseLane(XMLElement* elem) {
        Lane lane;
        lane.id = getAttrInt(elem, "id");
        lane.type = parseLaneType(getAttrStr(elem, "type"));
        lane.level = getAttrStr(elem, "level");
        
        // Parse link
        if (XMLElement* link = elem->FirstChildElement("link")) {
            if (XMLElement* pred = link->FirstChildElement("predecessor")) {
                lane.predecessorId = getAttrInt(pred, "id");
            }
            if (XMLElement* succ = link->FirstChildElement("successor")) {
                lane.successorId = getAttrInt(succ, "id");
            }
        }
        
        // Parse widths
        for (XMLElement* widthElem = elem->FirstChildElement("width");
             widthElem;
             widthElem = widthElem->NextSiblingElement("width")) {
            LaneWidth width;
            width.sOffset = getAttrDouble(widthElem, "sOffset");
            width.a = getAttrDouble(widthElem, "a");
            width.b = getAttrDouble(widthElem, "b");
            width.c = getAttrDouble(widthElem, "c");
            width.d = getAttrDouble(widthElem, "d");
            lane.widths.push_back(width);
        }
        
        return lane;
    }
    
    Signal parseSignal(XMLElement* elem) {
        Signal sig;
        sig.id = getAttrStr(elem, "id");
        sig.s = getAttrDouble(elem, "s");
        sig.t = getAttrDouble(elem, "t");
        sig.name = getAttrStr(elem, "name");
        sig.type = getAttrStr(elem, "type");
        sig.subtype = getAttrStr(elem, "subtype");
        sig.value = getAttrDouble(elem, "value");
        sig.unit = getAttrStr(elem, "unit");
        sig.hOffset = getAttrDouble(elem, "hOffset");
        sig.pitch = getAttrDouble(elem, "pitch");
        sig.roll = getAttrDouble(elem, "roll");
        sig.orientation = getAttrStr(elem, "orientation", "+");
        sig.dynamic = getAttrStr(elem, "dynamic") == "yes";
        return sig;
    }
    
    Junction parseJunction(XMLElement* elem) {
        Junction junc;
        junc.id = getAttrStr(elem, "id");
        junc.name = getAttrStr(elem, "name");
        
        for (XMLElement* connElem = elem->FirstChildElement("connection");
             connElem;
             connElem = connElem->NextSiblingElement("connection")) {
            JunctionConnection conn;
            conn.id = getAttrStr(connElem, "id");
            conn.incomingRoad = getAttrStr(connElem, "incomingRoad");
            conn.connectingRoad = getAttrStr(connElem, "connectingRoad");
            conn.contactPoint = getAttrStr(connElem, "contactPoint");
            
            for (XMLElement* linkElem = connElem->FirstChildElement("laneLink");
                 linkElem;
                 linkElem = linkElem->NextSiblingElement("laneLink")) {
                int from = getAttrInt(linkElem, "from");
                int to = getAttrInt(linkElem, "to");
                conn.laneLinkFrom.push_back({from, to});
            }
            
            junc.connections.push_back(conn);
        }
        
        return junc;
    }
};

// ============ Public Interface ============

Parser::Parser() : impl_(std::make_unique<Impl>()) {}

Parser::~Parser() = default;

OpenDriveMap Parser::parseFile(const std::string& filepath) {
    XMLDocument doc;
    XMLError err = doc.LoadFile(filepath.c_str());
    
    if (err != XML_SUCCESS) {
        throw ParseException("Failed to load file: " + filepath + 
                           " (error: " + std::to_string(err) + ")");
    }
    
    return impl_->parse(doc);
}

OpenDriveMap Parser::parseString(const std::string& xmlContent) {
    XMLDocument doc;
    XMLError err = doc.Parse(xmlContent.c_str());
    
    if (err != XML_SUCCESS) {
        throw ParseException("Failed to parse XML (error: " + 
                           std::to_string(err) + ")");
    }
    
    return impl_->parse(doc);
}

std::vector<std::string> Parser::validate(const OpenDriveMap& map) {
    std::vector<std::string> issues;
    
    // Check for empty map
    if (map.roads.empty()) {
        issues.push_back("Warning: Map contains no roads");
    }
    
    // Validate each road
    for (const auto& road : map.roads) {
        if (road.planView.empty()) {
            issues.push_back("Error: Road " + road.id + " has no geometry");
        }
        if (road.laneSections.empty()) {
            issues.push_back("Warning: Road " + road.id + " has no lane sections");
        }
        
        // Check geometry continuity
        double expectedS = 0;
        for (const auto& geom : road.planView) {
            if (std::abs(geom.s - expectedS) > 0.001) {
                issues.push_back("Warning: Road " + road.id + 
                               " has geometry gap at s=" + std::to_string(geom.s));
            }
            expectedS = geom.s + geom.length;
        }
    }
    
    return issues;
}

std::string Parser::version() {
    return "OpenDRIVE Parser v1.0.0 (supports OpenDRIVE 1.4-1.6)";
}

// ============ OpenDriveMap Methods ============

const Road* OpenDriveMap::getRoad(const std::string& id) const {
    for (const auto& road : roads) {
        if (road.id == id) return &road;
    }
    return nullptr;
}

const Junction* OpenDriveMap::getJunction(const std::string& id) const {
    for (const auto& junc : junctions) {
        if (junc.id == id) return &junc;
    }
    return nullptr;
}

size_t OpenDriveMap::totalRoadLength() const {
    double total = 0;
    for (const auto& road : roads) {
        total += road.length;
    }
    return static_cast<size_t>(total);
}

size_t OpenDriveMap::totalLaneCount() const {
    size_t count = 0;
    for (const auto& road : roads) {
        for (const auto& section : road.laneSections) {
            count += section.leftLanes.size() + section.rightLanes.size();
        }
    }
    return count;
}

size_t OpenDriveMap::totalSignalCount() const {
    size_t count = 0;
    for (const auto& road : roads) {
        count += road.signals.size();
    }
    return count;
}

const LaneSection* Road::getLaneSectionAt(double s) const {
    const LaneSection* active = nullptr;
    for (const auto& section : laneSections) {
        if (section.s <= s) active = &section;
        else break;
    }
    return active;
}

SignalType Signal::getSignalType() const {
    // German traffic sign types (common in OpenDRIVE)
    if (type == "274" || type.find("speed") != std::string::npos) {
        return SignalType::SPEED_LIMIT;
    }
    if (type == "206" || type == "stop") {
        return SignalType::STOP;
    }
    if (type == "205" || type == "yield") {
        return SignalType::YIELD;
    }
    if (type.find("light") != std::string::npos || type == "1000001") {
        return SignalType::TRAFFIC_LIGHT;
    }
    return SignalType::UNKNOWN;
}

}  // namespace opendrive
