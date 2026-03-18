#pragma once

#include "types.hpp"
#include <string>
#include <memory>
#include <stdexcept>

namespace opendrive {

class ParseException : public std::runtime_error {
public:
    explicit ParseException(const std::string& msg) : std::runtime_error(msg) {}
};

/**
 * OpenDRIVE XML Parser
 * 
 * Parses .xodr files into structured OpenDriveMap objects.
 * Supports OpenDRIVE 1.4, 1.5, and 1.6 formats.
 */
class Parser {
public:
    Parser();
    ~Parser();
    
    /**
     * Parse OpenDRIVE file from path
     * @param filepath Path to .xodr file
     * @return Parsed map structure
     * @throws ParseException on parse errors
     */
    OpenDriveMap parseFile(const std::string& filepath);
    
    /**
     * Parse OpenDRIVE from XML string
     * @param xmlContent XML content as string
     * @return Parsed map structure
     * @throws ParseException on parse errors
     */
    OpenDriveMap parseString(const std::string& xmlContent);
    
    /**
     * Validate OpenDRIVE structure
     * @param map Map to validate
     * @return Vector of validation warnings/errors
     */
    std::vector<std::string> validate(const OpenDriveMap& map);
    
    /**
     * Get parser version info
     */
    static std::string version();

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

}  // namespace opendrive
