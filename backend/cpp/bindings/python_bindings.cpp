#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/operators.h>

#include "opendrive/types.hpp"
#include "opendrive/parser.hpp"
#include "opendrive/geometry.hpp"
#include "opendrive/route_planner.hpp"

namespace py = pybind11;

PYBIND11_MODULE(opendrive_core, m) {
    m.doc() = "OpenDRIVE Road Network Parser and Route Planner";
    
    // ============ Basic Types ============
    
    py::class_<opendrive::Point2D>(m, "Point2D")
        .def(py::init<>())
        .def(py::init<double, double>())
        .def_readwrite("x", &opendrive::Point2D::x)
        .def_readwrite("y", &opendrive::Point2D::y)
        .def("distance_to", &opendrive::Point2D::distanceTo)
        .def("__repr__", [](const opendrive::Point2D& p) {
            return "Point2D(" + std::to_string(p.x) + ", " + std::to_string(p.y) + ")";
        });
    
    py::class_<opendrive::Point3D, opendrive::Point2D>(m, "Point3D")
        .def(py::init<>())
        .def(py::init<double, double, double>())
        .def_readwrite("z", &opendrive::Point3D::z)
        .def("__repr__", [](const opendrive::Point3D& p) {
            return "Point3D(" + std::to_string(p.x) + ", " + 
                   std::to_string(p.y) + ", " + std::to_string(p.z) + ")";
        });
    
    py::class_<opendrive::Pose>(m, "Pose")
        .def(py::init<>())
        .def_readwrite("position", &opendrive::Pose::position)
        .def_readwrite("heading", &opendrive::Pose::heading)
        .def_readwrite("pitch", &opendrive::Pose::pitch)
        .def_readwrite("roll", &opendrive::Pose::roll);
    
    // ============ Enums ============
    
    py::enum_<opendrive::GeometryType>(m, "GeometryType")
        .value("LINE", opendrive::GeometryType::LINE)
        .value("ARC", opendrive::GeometryType::ARC)
        .value("SPIRAL", opendrive::GeometryType::SPIRAL)
        .value("POLY3", opendrive::GeometryType::POLY3)
        .value("PARAM_POLY3", opendrive::GeometryType::PARAM_POLY3);
    
    py::enum_<opendrive::LaneType>(m, "LaneType")
        .value("NONE", opendrive::LaneType::NONE)
        .value("DRIVING", opendrive::LaneType::DRIVING)
        .value("STOP", opendrive::LaneType::STOP)
        .value("SHOULDER", opendrive::LaneType::SHOULDER)
        .value("BIKING", opendrive::LaneType::BIKING)
        .value("SIDEWALK", opendrive::LaneType::SIDEWALK)
        .value("BORDER", opendrive::LaneType::BORDER)
        .value("PARKING", opendrive::LaneType::PARKING)
        .value("MEDIAN", opendrive::LaneType::MEDIAN);
    
    py::enum_<opendrive::RoadType>(m, "RoadType")
        .value("UNKNOWN", opendrive::RoadType::UNKNOWN)
        .value("RURAL", opendrive::RoadType::RURAL)
        .value("MOTORWAY", opendrive::RoadType::MOTORWAY)
        .value("TOWN", opendrive::RoadType::TOWN)
        .value("LOW_SPEED", opendrive::RoadType::LOW_SPEED)
        .value("PEDESTRIAN", opendrive::RoadType::PEDESTRIAN)
        .value("BICYCLE", opendrive::RoadType::BICYCLE);
    
    py::enum_<opendrive::SignalType>(m, "SignalType")
        .value("UNKNOWN", opendrive::SignalType::UNKNOWN)
        .value("SPEED_LIMIT", opendrive::SignalType::SPEED_LIMIT)
        .value("STOP", opendrive::SignalType::STOP)
        .value("YIELD", opendrive::SignalType::YIELD)
        .value("TRAFFIC_LIGHT", opendrive::SignalType::TRAFFIC_LIGHT)
        .value("WARNING", opendrive::SignalType::WARNING)
        .value("REGULATORY", opendrive::SignalType::REGULATORY)
        .value("GUIDE", opendrive::SignalType::GUIDE);
    
    // ============ Geometry ============
    
    py::class_<opendrive::Geometry>(m, "Geometry")
        .def(py::init<>())
        .def_readwrite("s", &opendrive::Geometry::s)
        .def_readwrite("x", &opendrive::Geometry::x)
        .def_readwrite("y", &opendrive::Geometry::y)
        .def_readwrite("hdg", &opendrive::Geometry::hdg)
        .def_readwrite("length", &opendrive::Geometry::length)
        .def_readwrite("type", &opendrive::Geometry::type);
    
    // ============ Lane ============
    
    py::class_<opendrive::LaneWidth>(m, "LaneWidth")
        .def(py::init<>())
        .def_readwrite("sOffset", &opendrive::LaneWidth::sOffset)
        .def_readwrite("a", &opendrive::LaneWidth::a)
        .def_readwrite("b", &opendrive::LaneWidth::b)
        .def_readwrite("c", &opendrive::LaneWidth::c)
        .def_readwrite("d", &opendrive::LaneWidth::d)
        .def("get_width", &opendrive::LaneWidth::getWidth);
    
    py::class_<opendrive::Lane>(m, "Lane")
        .def(py::init<>())
        .def_readwrite("id", &opendrive::Lane::id)
        .def_readwrite("type", &opendrive::Lane::type)
        .def_readwrite("widths", &opendrive::Lane::widths)
        .def("get_width", &opendrive::Lane::getWidth);
    
    py::class_<opendrive::LaneSection>(m, "LaneSection")
        .def(py::init<>())
        .def_readwrite("s", &opendrive::LaneSection::s)
        .def_readwrite("left_lanes", &opendrive::LaneSection::leftLanes)
        .def_readwrite("center_lane", &opendrive::LaneSection::centerLane)
        .def_readwrite("right_lanes", &opendrive::LaneSection::rightLanes)
        .def("get_lane", &opendrive::LaneSection::getLane, py::return_value_policy::reference);
    
    // ============ Signal ============
    
    py::class_<opendrive::Signal>(m, "Signal")
        .def(py::init<>())
        .def_readwrite("id", &opendrive::Signal::id)
        .def_readwrite("s", &opendrive::Signal::s)
        .def_readwrite("t", &opendrive::Signal::t)
        .def_readwrite("name", &opendrive::Signal::name)
        .def_readwrite("type", &opendrive::Signal::type)
        .def_readwrite("subtype", &opendrive::Signal::subtype)
        .def_readwrite("value", &opendrive::Signal::value)
        .def_readwrite("dynamic", &opendrive::Signal::dynamic)
        .def("get_signal_type", &opendrive::Signal::getSignalType);
    
    // ============ Road ============
    
    py::class_<opendrive::Road>(m, "Road")
        .def(py::init<>())
        .def_readwrite("id", &opendrive::Road::id)
        .def_readwrite("name", &opendrive::Road::name)
        .def_readwrite("length", &opendrive::Road::length)
        .def_readwrite("junction_id", &opendrive::Road::junctionId)
        .def_readwrite("plan_view", &opendrive::Road::planView)
        .def_readwrite("lane_sections", &opendrive::Road::laneSections)
        .def_readwrite("signals", &opendrive::Road::signals)
        .def("get_pose_at", &opendrive::Road::getPoseAt)
        .def("get_lane_section_at", &opendrive::Road::getLaneSectionAt, py::return_value_policy::reference)
        .def("is_in_junction", &opendrive::Road::isInJunction);
    
    // ============ Junction ============
    
    py::class_<opendrive::JunctionConnection>(m, "JunctionConnection")
        .def(py::init<>())
        .def_readwrite("id", &opendrive::JunctionConnection::id)
        .def_readwrite("incoming_road", &opendrive::JunctionConnection::incomingRoad)
        .def_readwrite("connecting_road", &opendrive::JunctionConnection::connectingRoad);
    
    py::class_<opendrive::Junction>(m, "Junction")
        .def(py::init<>())
        .def_readwrite("id", &opendrive::Junction::id)
        .def_readwrite("name", &opendrive::Junction::name)
        .def_readwrite("connections", &opendrive::Junction::connections);
    
    // ============ OpenDriveMap ============
    
    py::class_<opendrive::OpenDriveMap>(m, "OpenDriveMap")
        .def(py::init<>())
        .def_readwrite("name", &opendrive::OpenDriveMap::name)
        .def_readwrite("version", &opendrive::OpenDriveMap::version)
        .def_readwrite("date", &opendrive::OpenDriveMap::date)
        .def_readwrite("roads", &opendrive::OpenDriveMap::roads)
        .def_readwrite("junctions", &opendrive::OpenDriveMap::junctions)
        .def("get_road", &opendrive::OpenDriveMap::getRoad, py::return_value_policy::reference)
        .def("get_junction", &opendrive::OpenDriveMap::getJunction, py::return_value_policy::reference)
        .def("total_road_length", &opendrive::OpenDriveMap::totalRoadLength)
        .def("total_lane_count", &opendrive::OpenDriveMap::totalLaneCount)
        .def("total_signal_count", &opendrive::OpenDriveMap::totalSignalCount);
    
    // ============ Parser ============
    
    py::class_<opendrive::Parser>(m, "Parser")
        .def(py::init<>())
        .def("parse_file", &opendrive::Parser::parseFile)
        .def("parse_string", &opendrive::Parser::parseString)
        .def("validate", &opendrive::Parser::validate)
        .def_static("version", &opendrive::Parser::version);
    
    py::register_exception<opendrive::ParseException>(m, "ParseException");
    
    // ============ Geometry Calculator ============
    
    py::class_<opendrive::GeometryCalculator>(m, "GeometryCalculator")
        .def_static("sample_geometry", &opendrive::GeometryCalculator::sampleGeometry,
                   py::arg("geom"), py::arg("resolution") = 1.0)
        .def_static("get_pose_at", &opendrive::GeometryCalculator::getPoseAt)
        .def_static("sample_road", &opendrive::GeometryCalculator::sampleRoad,
                   py::arg("road"), py::arg("resolution") = 1.0)
        .def_static("get_road_pose_at", &opendrive::GeometryCalculator::getRoadPoseAt)
        .def_static("sample_lane_boundary", &opendrive::GeometryCalculator::sampleLaneBoundary,
                   py::arg("road"), py::arg("lane_id"), py::arg("resolution") = 1.0)
        .def_static("sample_lane_center", &opendrive::GeometryCalculator::sampleLaneCenter,
                   py::arg("road"), py::arg("lane_id"), py::arg("resolution") = 1.0);
    
    // ============ Route ============
    
    py::class_<opendrive::Route>(m, "Route")
        .def(py::init<>())
        .def_readwrite("waypoints", &opendrive::Route::waypoints)
        .def_readwrite("road_ids", &opendrive::Route::roadIds)
        .def_readwrite("lane_ids", &opendrive::Route::laneIds)
        .def_readwrite("total_length", &opendrive::Route::totalLength)
        .def_readwrite("estimated_time", &opendrive::Route::estimatedTime)
        .def_readwrite("valid", &opendrive::Route::valid)
        .def_readwrite("error_message", &opendrive::Route::errorMessage);
    
    py::class_<opendrive::RoutePlannerOptions>(m, "RoutePlannerOptions")
        .def(py::init<>())
        .def_readwrite("prefer_highways", &opendrive::RoutePlannerOptions::preferHighways)
        .def_readwrite("avoid_u_turns", &opendrive::RoutePlannerOptions::avoidUTurns)
        .def_readwrite("max_speed", &opendrive::RoutePlannerOptions::maxSpeed)
        .def_readwrite("lane_change_penalty", &opendrive::RoutePlannerOptions::laneChangePenalty)
        .def_readwrite("turn_penalty", &opendrive::RoutePlannerOptions::turnPenalty);
    
    // ============ Route Planner ============
    
    py::class_<opendrive::RoutePlanner>(m, "RoutePlanner")
        .def(py::init<const opendrive::OpenDriveMap&, double>(),
             py::arg("map"), py::arg("graph_resolution") = 10.0)
        .def("plan_route", &opendrive::RoutePlanner::planRoute,
             py::arg("start"), py::arg("goal"), 
             py::arg("options") = opendrive::RoutePlannerOptions())
        .def("plan_route_multi", &opendrive::RoutePlanner::planRouteMulti,
             py::arg("waypoints"), py::arg("options") = opendrive::RoutePlannerOptions())
        .def("find_reachable", &opendrive::RoutePlanner::findReachable);
    
    // ============ Scenario Route Generator ============
    
    py::class_<opendrive::ScenarioRouteGenerator>(m, "ScenarioRouteGenerator")
        .def(py::init<const opendrive::OpenDriveMap&>())
        .def("generate_random_route", &opendrive::ScenarioRouteGenerator::generateRandomRoute,
             py::arg("min_length"), py::arg("max_length"))
        .def("generate_route_with_lane_changes", 
             &opendrive::ScenarioRouteGenerator::generateRouteWithLaneChanges,
             py::arg("min_lane_changes"), py::arg("length"));
    
    // ============ Module Info ============
    
    m.attr("__version__") = "1.0.0";
}
