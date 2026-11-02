package com.radar.campusexplorer.data.repository

import com.radar.campusexplorer.domain.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class CampusDataRepository {

    private val _buildings = MutableStateFlow<List<Building>>(emptyList())
    val buildings: StateFlow<List<Building>> = _buildings.asStateFlow()

    private val _rooms = MutableStateFlow<List<Room>>(emptyList())
    val rooms: StateFlow<List<Room>> = _rooms.asStateFlow()

    private val _alerts = MutableStateFlow<List<AlertItem>>(emptyList())
    val alerts: StateFlow<List<AlertItem>> = _alerts.asStateFlow()

    private val _hazards = MutableStateFlow<List<HazardReport>>(emptyList())
    val hazards: StateFlow<List<HazardReport>> = _hazards.asStateFlow()

    private val _studentProfile = MutableStateFlow(StudentProfile())
    val studentProfile: StateFlow<StudentProfile> = _studentProfile.asStateFlow()

    private val _weather = MutableStateFlow(WeatherState())
    val weather: StateFlow<WeatherState> = _weather.asStateFlow()

    private val _disasterWatch = MutableStateFlow<List<DisasterWatchItem>>(emptyList())
    val disasterWatch: StateFlow<List<DisasterWatchItem>> = _disasterWatch.asStateFlow()

    private val _currentMission = MutableStateFlow(Mission())
    val currentMission: StateFlow<Mission> = _currentMission.asStateFlow()

    private val _characterPos = MutableStateFlow(PointF(624f, 660f))
    val characterPos: StateFlow<PointF> = _characterPos.asStateFlow()

    private val _selectedBuilding = MutableStateFlow<Building?>(null)
    val selectedBuilding: StateFlow<Building?> = _selectedBuilding.asStateFlow()

    private val _activeLayer = MutableStateFlow("Campus")
    val activeLayer: StateFlow<String> = _activeLayer.asStateFlow()

    init {
        loadMockData()
    }

    private fun loadMockData() {
        val buildingList = listOf(
            Building(
                id = "c",
                name = "Building C",
                label = "Bldg. C",
                kind = "2 floors · 10 rooms",
                floors = 2,
                roomCount = 10,
                reportedHazards = 1,
                verifiedStatus = "Verified Safe",
                lastInspectionDate = "Jan 12, 2025",
                description = "Five classrooms on each of two floors, connected by the staircase on the left. Click any door to view or add its photo.",
                boundsLeft = 80f, boundsTop = 260f, boundsWidth = 208f, boundsHeight = 143f,
                arrivalPoint = PointF(181f, 409f),
                interiorScene = "c1"
            ),
            Building(
                id = "lab",
                name = "Chemistry Lab",
                label = "Chemistry Lab",
                kind = "1 floor · 1 room",
                floors = 1,
                roomCount = 1,
                reportedHazards = 0,
                verifiedStatus = "Verified Safe",
                lastInspectionDate = "Jan 14, 2025",
                description = "A single laboratory room, reached through a hallway in the supplied floor-plan style.",
                boundsLeft = 305f, boundsTop = 291f, boundsWidth = 189f, boundsHeight = 107f,
                arrivalPoint = PointF(408f, 408f),
                interiorScene = "lab1"
            ),
            Building(
                id = "b",
                name = "Building B",
                label = "Bldg. B",
                kind = "2 floors · 4 classrooms",
                floors = 2,
                roomCount = 4,
                reportedHazards = 0,
                verifiedStatus = "Verified Safe",
                lastInspectionDate = "Jan 10, 2025",
                description = "Explore two classrooms on each floor. The internal staircase on the left connects both floors.",
                boundsLeft = 503f, boundsTop = 260f, boundsWidth = 204f, boundsHeight = 144f,
                arrivalPoint = PointF(605f, 409f),
                interiorScene = "b1"
            ),
            Building(
                id = "a",
                name = "Building A",
                label = "Bldg. A",
                kind = "1 floor · 2 classrooms",
                floors = 1,
                roomCount = 2,
                reportedHazards = 0,
                verifiedStatus = "Verified Safe",
                lastInspectionDate = "Jan 08, 2025",
                description = "A single hallway with two classroom doors and the original central exit.",
                boundsLeft = 774f, boundsTop = 298f, boundsWidth = 192f, boundsHeight = 106f,
                arrivalPoint = PointF(868f, 411f),
                interiorScene = "a1"
            ),
            Building(
                id = "d_upper",
                name = "Building D Upper",
                label = "bldg. d",
                kind = "1 floor · 2 rooms",
                floors = 1,
                roomCount = 2,
                reportedHazards = 1,
                verifiedStatus = "Minor Advisory",
                lastInspectionDate = "Jan 11, 2025",
                description = "The upper-right campus building. Explore its two rooms in a hallway matching the supplied floor plan.",
                boundsLeft = 1005f, boundsTop = 309f, boundsWidth = 204f, boundsHeight = 95f,
                arrivalPoint = PointF(1112f, 411f),
                interiorScene = "d1"
            ),
            Building(
                id = "d_main",
                name = "Building D",
                label = "Bldg. D",
                kind = "2 floors · 6 rooms",
                floors = 2,
                roomCount = 6,
                reportedHazards = 0,
                verifiedStatus = "Verified Safe",
                lastInspectionDate = "Jan 13, 2025",
                description = "The pond-side building has three classrooms on each of two floors, connected by an internal staircase.",
                boundsLeft = 286f, boundsTop = 452f, boundsWidth = 111f, boundsHeight = 253f,
                arrivalPoint = PointF(347f, 716f),
                interiorScene = "e1"
            ),
            Building(
                id = "court",
                name = "Covered Court",
                label = "Covered Court",
                kind = "Evacuation Assembly Area",
                floors = 1,
                roomCount = 0,
                reportedHazards = 0,
                verifiedStatus = "Designated Safe Zone",
                lastInspectionDate = "Jan 15, 2025",
                description = "Primary evacuation assembly area for San Roque NHS. Open structure with clear emergency access routes.",
                boundsLeft = 490f, boundsTop = 536f, boundsWidth = 269f, boundsHeight = 151f,
                arrivalPoint = PointF(624f, 660f)
            ),
            Building(
                id = "office",
                name = "Principal's Office",
                label = "Principal's Office",
                kind = "Administration",
                floors = 1,
                roomCount = 3,
                reportedHazards = 0,
                verifiedStatus = "Verified Safe",
                lastInspectionDate = "Jan 14, 2025",
                description = "Administration hub housing school emergency management command.",
                boundsLeft = 961f, boundsTop = 475f, boundsWidth = 140f, boundsHeight = 231f,
                arrivalPoint = PointF(1033f, 713f)
            ),
            Building(
                id = "canteen",
                name = "Canteen",
                label = "Canteen",
                kind = "School Dining & Relief",
                floors = 1,
                roomCount = 2,
                reportedHazards = 0,
                verifiedStatus = "Verified Safe",
                lastInspectionDate = "Jan 12, 2025",
                description = "Eastern campus dining facility designated as emergency water and food distribution center.",
                boundsLeft = 1119f, boundsTop = 422f, boundsWidth = 99f, boundsHeight = 299f,
                arrivalPoint = PointF(1172f, 732f)
            )
        )
        _buildings.value = buildingList

        val roomList = listOf(
            Room("c-101", "Room 101", "c", 1, doorX = 120f, doorY = 320f),
            Room("c-102", "Room 102", "c", 1, doorX = 160f, doorY = 320f),
            Room("c-103", "Room 103", "c", 1, doorX = 200f, doorY = 320f),
            Room("c-201", "Room 201", "c", 2, doorX = 120f, doorY = 280f),
            Room("c-202", "Room 202", "c", 2, doorX = 160f, doorY = 280f),
            Room("lab-1", "Chem Lab Main", "lab", 1, doorX = 390f, doorY = 340f),
            Room("b-101", "Room B1", "b", 1, doorX = 550f, doorY = 320f),
            Room("b-102", "Room B2", "b", 1, doorX = 610f, doorY = 320f),
            Room("a-101", "Room A1", "a", 1, doorX = 820f, doorY = 340f),
            Room("a-102", "Room A2", "a", 1, doorX = 890f, doorY = 340f)
        )
        _rooms.value = roomList

        val alertList = listOf(
            AlertItem(
                id = "ALT-001",
                title = "Flood Advisory Issued",
                category = "PAGASA Weather Update",
                severity = ThreatLevel.ADVISORY,
                issuingAuthority = "PAGASA Weather Services",
                description = "Light to moderate rainfall expected over San Roque area. School operations remain normal. Exercise caution along low-lying grounds.",
                timestamp = "Today 09:30 AM"
            ),
            AlertItem(
                id = "ALT-002",
                title = "Earthquake Drill Scheduled",
                category = "School DRRM Notice",
                severity = ThreatLevel.NORMAL,
                issuingAuthority = "School Disaster Management",
                description = "Quarterly evacuation drill scheduled for Friday, 2:00 PM. All students to proceed to Covered Court upon alarm.",
                timestamp = "Jan 14, 2025"
            ),
            AlertItem(
                id = "ALT-003",
                title = "Inspect Staircase B-2 Structural Crack",
                category = "Hazard Advisory",
                severity = ThreatLevel.WARNING,
                issuingAuthority = "Campus Inspection Team",
                description = "Minor surface plaster crack reported near Staircase B-2 landing. Inspection requested before next drill.",
                timestamp = "Jan 13, 2025"
            )
        )
        _alerts.value = alertList

        val hazardList = listOf(
            HazardReport(
                id = "HAZ-001",
                title = "Minor Plaster Wall Crack",
                category = "Earthquake Crack",
                severity = ThreatLevel.WARNING,
                location = "Building C - 2nd Floor Corridor",
                buildingId = "c",
                roomId = "c-201",
                reporterName = "Inspector Juan Cruz",
                timestamp = "Jan 13, 2025 11:15 AM",
                description = "Hairline crack observed near window column. Non-structural, requires monitoring.",
                status = "Under Review"
            ),
            HazardReport(
                id = "HAZ-002",
                title = "Exposed Electrical Conduit",
                category = "Electrical Hazard",
                severity = ThreatLevel.ADVISORY,
                location = "bldg. d - Room D-102",
                buildingId = "d_upper",
                roomId = null,
                reporterName = "Alex Santos",
                timestamp = "Jan 11, 2025 03:40 PM",
                description = "Conduit cover missing near door switch.",
                status = "Scheduled Repair"
            )
        )
        _hazards.value = hazardList

        val disasterWatchList = listOf(
            DisasterWatchItem("Typhoon", "No Threat", ThreatLevel.NORMAL),
            DisasterWatchItem("Earthquake", "Normal", ThreatLevel.NORMAL),
            DisasterWatchItem("Volcanic", "Normal", ThreatLevel.NORMAL),
            DisasterWatchItem("Flood", "Advisory", ThreatLevel.ADVISORY)
        )
        _disasterWatch.value = disasterWatchList
    }

    fun selectBuilding(building: Building?) {
        _selectedBuilding.value = building
    }

    fun moveCharacter(dx: Float, dy: Float) {
        val current = _characterPos.value
        val newX = (current.x + dx).coerceIn(50f, 1250f)
        val newY = (current.y + dy).coerceIn(200f, 780f)
        _characterPos.value = PointF(newX, newY)
    }

    fun setCharacterPos(x: Float, y: Float) {
        _characterPos.value = PointF(x, y)
    }

    fun setActiveLayer(layer: String) {
        _activeLayer.value = layer
    }

    fun updateStudentProfile(updated: StudentProfile) {
        _studentProfile.value = updated
    }

    fun addHazardReport(report: HazardReport) {
        _hazards.update { listOf(report) + it }
        // Update mission progress
        val mission = _currentMission.value
        if (mission.progress < mission.total) {
            _currentMission.value = mission.copy(progress = mission.progress + 1)
        }
    }

    fun incrementMissionProgress() {
        val mission = _currentMission.value
        if (mission.progress < mission.total) {
            _currentMission.value = mission.copy(progress = mission.progress + 1)
        }
    }
}
