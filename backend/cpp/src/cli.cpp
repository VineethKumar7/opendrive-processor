#include "opendrive/parser.hpp"
#include "opendrive/geometry.hpp"
#include "opendrive/route_planner.hpp"
#include <iostream>
#include <iomanip>

void printUsage(const char* prog) {
    std::cout << "OpenDRIVE Road Network Processor CLI\n\n"
              << "Usage: " << prog << " <command> [options]\n\n"
              << "Commands:\n"
              << "  parse <file.xodr>     Parse and show map info\n"
              << "  validate <file.xodr>  Validate OpenDRIVE file\n"
              << "  export <file.xodr>    Export road geometry to CSV\n"
              << "  version               Show version info\n";
}

void parseCommand(const std::string& filepath) {
    opendrive::Parser parser;
    
    try {
        auto map = parser.parseFile(filepath);
        
        std::cout << "=== OpenDRIVE Map Info ===\n"
                  << "Name: " << map.name << "\n"
                  << "Version: " << map.version << "\n"
                  << "Date: " << map.date << "\n\n"
                  << "Statistics:\n"
                  << "  Roads: " << map.roads.size() << "\n"
                  << "  Junctions: " << map.junctions.size() << "\n"
                  << "  Total Road Length: " << map.totalRoadLength() << " m\n"
                  << "  Total Lanes: " << map.totalLaneCount() << "\n"
                  << "  Total Signals: " << map.totalSignalCount() << "\n\n";
        
        std::cout << "Roads:\n";
        for (const auto& road : map.roads) {
            std::cout << "  [" << road.id << "] " << road.name 
                      << " (length: " << std::fixed << std::setprecision(1) 
                      << road.length << " m";
            if (road.isInJunction()) {
                std::cout << ", junction: " << road.junctionId;
            }
            std::cout << ")\n";
            
            // Show lane info
            for (const auto& section : road.laneSections) {
                int leftCount = section.leftLanes.size();
                int rightCount = section.rightLanes.size();
                std::cout << "    Lane section at s=" << section.s 
                          << ": " << leftCount << " left, " << rightCount << " right\n";
            }
        }
        
        if (!map.junctions.empty()) {
            std::cout << "\nJunctions:\n";
            for (const auto& junc : map.junctions) {
                std::cout << "  [" << junc.id << "] " << junc.name
                          << " (" << junc.connections.size() << " connections)\n";
            }
        }
        
    } catch (const opendrive::ParseException& e) {
        std::cerr << "Parse error: " << e.what() << "\n";
        exit(1);
    }
}

void validateCommand(const std::string& filepath) {
    opendrive::Parser parser;
    
    try {
        auto map = parser.parseFile(filepath);
        auto issues = parser.validate(map);
        
        if (issues.empty()) {
            std::cout << "✓ Validation passed - no issues found\n";
        } else {
            std::cout << "Validation found " << issues.size() << " issue(s):\n";
            for (const auto& issue : issues) {
                std::cout << "  • " << issue << "\n";
            }
        }
        
    } catch (const opendrive::ParseException& e) {
        std::cerr << "✗ Parse error: " << e.what() << "\n";
        exit(1);
    }
}

void exportCommand(const std::string& filepath) {
    opendrive::Parser parser;
    
    try {
        auto map = parser.parseFile(filepath);
        
        std::cout << "road_id,x,y,z,heading\n";
        
        for (const auto& road : map.roads) {
            auto points = opendrive::GeometryCalculator::sampleRoad(road, 5.0);
            
            double s = 0;
            double step = road.length / (points.size() - 1);
            
            for (const auto& pt : points) {
                auto pose = road.getPoseAt(s);
                std::cout << road.id << "," 
                          << std::fixed << std::setprecision(3)
                          << pt.x << "," << pt.y << "," << pt.z << ","
                          << pose.heading << "\n";
                s += step;
            }
        }
        
    } catch (const opendrive::ParseException& e) {
        std::cerr << "Parse error: " << e.what() << "\n";
        exit(1);
    }
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printUsage(argv[0]);
        return 1;
    }
    
    std::string command = argv[1];
    
    if (command == "version") {
        std::cout << opendrive::Parser::version() << "\n";
        return 0;
    }
    
    if (argc < 3) {
        std::cerr << "Error: Missing file argument\n";
        printUsage(argv[0]);
        return 1;
    }
    
    std::string filepath = argv[2];
    
    if (command == "parse") {
        parseCommand(filepath);
    } else if (command == "validate") {
        validateCommand(filepath);
    } else if (command == "export") {
        exportCommand(filepath);
    } else {
        std::cerr << "Unknown command: " << command << "\n";
        printUsage(argv[0]);
        return 1;
    }
    
    return 0;
}
