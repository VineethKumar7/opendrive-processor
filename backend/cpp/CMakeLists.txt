cmake_minimum_required(VERSION 3.15)
project(opendrive_core VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Options
option(BUILD_PYTHON_BINDINGS "Build Python bindings" ON)
option(BUILD_TESTS "Build tests" OFF)

# Find dependencies
find_package(PkgConfig REQUIRED)

# TinyXML2 for XML parsing
find_package(tinyxml2 QUIET)
if(NOT tinyxml2_FOUND)
    pkg_check_modules(TINYXML2 REQUIRED tinyxml2)
endif()

# Core library sources
set(CORE_SOURCES
    src/parser.cpp
    src/geometry.cpp
    src/route_planner.cpp
)

# Include directories
include_directories(include)

# Static library (for linking)
add_library(opendrive_static STATIC ${CORE_SOURCES})
target_include_directories(opendrive_static PUBLIC include)
if(tinyxml2_FOUND)
    target_link_libraries(opendrive_static PUBLIC tinyxml2::tinyxml2)
else()
    target_include_directories(opendrive_static PRIVATE ${TINYXML2_INCLUDE_DIRS})
    target_link_libraries(opendrive_static PUBLIC ${TINYXML2_LIBRARIES})
endif()

# Shared library
add_library(opendrive SHARED ${CORE_SOURCES})
target_include_directories(opendrive PUBLIC include)
if(tinyxml2_FOUND)
    target_link_libraries(opendrive PUBLIC tinyxml2::tinyxml2)
else()
    target_include_directories(opendrive PRIVATE ${TINYXML2_INCLUDE_DIRS})
    target_link_libraries(opendrive PUBLIC ${TINYXML2_LIBRARIES})
endif()
set_target_properties(opendrive PROPERTIES
    VERSION ${PROJECT_VERSION}
    SOVERSION 1
)

# Python bindings
if(BUILD_PYTHON_BINDINGS)
    find_package(Python COMPONENTS Interpreter Development REQUIRED)
    find_package(pybind11 CONFIG QUIET)
    
    if(NOT pybind11_FOUND)
        # Try to find pybind11 via pip
        execute_process(
            COMMAND ${Python_EXECUTABLE} -c "import pybind11; print(pybind11.get_cmake_dir())"
            OUTPUT_VARIABLE PYBIND11_CMAKE_DIR
            OUTPUT_STRIP_TRAILING_WHITESPACE
            ERROR_QUIET
        )
        if(PYBIND11_CMAKE_DIR)
            list(APPEND CMAKE_PREFIX_PATH ${PYBIND11_CMAKE_DIR})
            find_package(pybind11 CONFIG REQUIRED)
        else()
            message(FATAL_ERROR "pybind11 not found. Install with: pip install pybind11")
        endif()
    endif()
    
    pybind11_add_module(opendrive_core bindings/python_bindings.cpp)
    target_link_libraries(opendrive_core PRIVATE opendrive_static)
    
    # Install Python module
    install(TARGETS opendrive_core
        LIBRARY DESTINATION ${Python_SITEARCH}
    )
endif()

# Install targets
install(TARGETS opendrive opendrive_static
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
)

install(DIRECTORY include/opendrive
    DESTINATION include
)

# CLI tool (optional)
add_executable(opendrive_cli src/cli.cpp)
target_link_libraries(opendrive_cli PRIVATE opendrive_static)
install(TARGETS opendrive_cli RUNTIME DESTINATION bin)

message(STATUS "OpenDRIVE Core Configuration:")
message(STATUS "  Version: ${PROJECT_VERSION}")
message(STATUS "  C++ Standard: ${CMAKE_CXX_STANDARD}")
message(STATUS "  Python Bindings: ${BUILD_PYTHON_BINDINGS}")
message(STATUS "  Build Tests: ${BUILD_TESTS}")
