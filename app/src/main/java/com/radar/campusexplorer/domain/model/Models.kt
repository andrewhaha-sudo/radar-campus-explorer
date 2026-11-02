package com.radar.campusexplorer.domain.model

enum class ThreatLevel {
    NORMAL,
    ADVISORY,
    WARNING,
    CRITICAL
}

enum class AvatarType {
    BOY,
    GIRL
}

data class PointF(val x: Float, val y: Float)

data class Building(
    val id: String,
    val name: String,
    val label: String,
    val kind: String,
    val floors: Int,
    val roomCount: Int,
    val reportedHazards: Int,
    val verifiedStatus: String,
    val lastInspectionDate: String,
    val description: String,
    val boundsLeft: Float,
    val boundsTop: Float,
    val boundsWidth: Float,
    val boundsHeight: Float,
    val arrivalPoint: PointF,
    val interiorScene: String? = null
)

data class Room(
    val id: String,
    val name: String,
    val buildingId: String,
    val floor: Int,
    val hasPhoto: Boolean = false,
    val photoUrl: String? = null,
    val hazardCount: Int = 0,
    val isInspected: Boolean = true,
    val doorX: Float,
    val doorY: Float
)

data class HazardReport(
    val id: String,
    val title: String,
    val category: String,
    val severity: ThreatLevel,
    val location: String,
    val buildingId: String,
    val roomId: String? = null,
    val reporterName: String,
    val timestamp: String,
    val description: String,
    val status: String,
    val photoUrl: String? = null
)

data class AlertItem(
    val id: String,
    val title: String,
    val category: String,
    val severity: ThreatLevel,
    val issuingAuthority: String,
    val description: String,
    val timestamp: String,
    val isRead: Boolean = false,
    val affectedArea: String = "San Roque NHS Campus"
)

data class StudentProfile(
    val id: String = "STU-2025-001",
    val name: String = "Alex Santos",
    val role: String = "Student",
    val gradeSection: String = "Grade 10 - A",
    val avatarType: AvatarType = AvatarType.BOY,
    val schoolName: String = "San Roque National High School",
    val isLocationShared: Boolean = true,
    val emergencyContactName: String = "Maria Santos (Parent)",
    val emergencyContactPhone: String = "+63 917 555 0192"
)

data class WeatherState(
    val condition: String = "Rainy",
    val temperatureC: Int = 27,
    val windKmH: Int = 14,
    val humidityPercent: Int = 88,
    val source: String = "PAGASA Sub-Station",
    val lastUpdated: String = "10:24 AM"
)

data class DisasterWatchItem(
    val category: String,
    val statusText: String,
    val threatLevel: ThreatLevel
)

data class Mission(
    val id: String = "M-001",
    val title: String = "Inspect Classrooms",
    val progress: Int = 0,
    val total: Int = 3,
    val description: String = "Check for possible hazards in your assigned area."
)

data class CameraScanResult(
    val roomName: String,
    val safetyScore: Int,
    val conditionText: String,
    val detectedHazards: List<String>,
    val timestamp: String
)
