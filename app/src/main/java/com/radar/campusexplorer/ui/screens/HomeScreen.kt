package com.radar.campusexplorer.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.radar.campusexplorer.data.repository.CampusDataRepository
import com.radar.campusexplorer.domain.model.Building
import com.radar.campusexplorer.domain.model.Room
import com.radar.campusexplorer.ui.components.*
import com.radar.campusexplorer.ui.map.CampusMapCanvas
import com.radar.campusexplorer.ui.theme.*

@Composable
fun HomeScreen(
    repository: CampusDataRepository = remember { CampusDataRepository() }
) {
    val buildings by repository.buildings.collectAsState()
    val rooms by repository.rooms.collectAsState()
    val alerts by repository.alerts.collectAsState()
    val studentProfile by repository.studentProfile.collectAsState()
    val weather by repository.weather.collectAsState()
    val disasterWatch by repository.disasterWatch.collectAsState()
    val currentMission by repository.currentMission.collectAsState()
    val characterPos by repository.characterPos.collectAsState()
    val selectedBuilding by repository.selectedBuilding.collectAsState()
    val activeLayer by repository.activeLayer.collectAsState()

    var activeScreen by remember { mutableStateOf("MainDashboard") }
    var activeTab by remember { mutableStateOf("Map") }
    var isRadialMenuOpen by remember { mutableStateOf(false) }
    var activeIndoorBuilding by remember { mutableStateOf<Building?>(null) }

    RadarTheme {
        Scaffold(
            topBar = {
                RadarHeader(
                    studentProfile = studentProfile,
                    onNotificationsClick = { activeScreen = "Alerts" },
                    onProfileClick = { activeScreen = "Profile" },
                    onSchoolSelectClick = { /* Dropdown */ }
                )
            },
            bottomBar = {
                RadarBottomBar(
                    activeTab = activeTab,
                    onTabSelected = { tab ->
                        activeTab = tab
                        when (tab) {
                            "Map" -> activeScreen = "MainDashboard"
                            "Inspect" -> activeScreen = "DRRM"
                            "Scan" -> activeScreen = "RoomScan"
                            "Alerts" -> activeScreen = "Alerts"
                            "Routes" -> activeScreen = "Routes"
                            "Students" -> activeScreen = "Profile"
                            "Resources" -> activeScreen = "DRRM"
                            "Settings" -> activeScreen = "Profile"
                        }
                    },
                    onCenterRadarClick = { isRadialMenuOpen = true }
                )
            },
            containerColor = DarkNavyBg
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // Main Content Switching
                when (activeScreen) {
                    "MainDashboard" -> {
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(6.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            // Left Side Navigation Drawer
                            RadarDrawer(
                                activeDestination = activeTab,
                                onNavigate = { dest ->
                                    activeTab = dest
                                    when (dest) {
                                        "Campus Map" -> activeScreen = "MainDashboard"
                                        "Hazard Map" -> {
                                            repository.setActiveLayer("Hazards")
                                            activeScreen = "MainDashboard"
                                        }
                                        "Room Scan" -> activeScreen = "RoomScan"
                                        "Alerts" -> activeScreen = "Alerts"
                                        "Routes" -> activeScreen = "Routes"
                                        "Profile" -> activeScreen = "Profile"
                                    }
                                },
                                onEmergencyClick = { activeScreen = "Emergency" }
                            )

                            // Center Campus Map Canvas
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight()
                            ) {
                                CampusMapCanvas(
                                    buildings = buildings,
                                    characterPos = characterPos,
                                    activeLayer = activeLayer,
                                    onBuildingClick = { b -> repository.selectBuilding(b) },
                                    onMoveCharacter = { dx, dy -> repository.moveCharacter(dx, dy) },
                                    onLayerToggle = {
                                        val next = when (activeLayer) {
                                            "Campus" -> "Hazards"
                                            "Hazards" -> "Routes"
                                            else -> "Campus"
                                        }
                                        repository.setActiveLayer(next)
                                    }
                                )

                                // Mascot & Current Mission overlay banner at bottom of map
                                Row(
                                    modifier = Modifier
                                        .align(Alignment.BottomStart)
                                        .padding(start = 12.dp, bottom = 48.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    RadarMascotDialog()
                                    RadarMissionCard(
                                        mission = currentMission,
                                        onClick = { activeScreen = "IndoorFloorPlan" }
                                    )
                                }
                            }

                            // Right Status Panel
                            Column(
                                modifier = Modifier
                                    .width(220.dp)
                                    .fillMaxHeight(),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                RadarLiveConditionsCard(
                                    weather = weather,
                                    disasterWatch = disasterWatch
                                )

                                RadarMiniMapCard(
                                    characterPos = characterPos,
                                    onZoomIn = {},
                                    onZoomOut = {},
                                    onRecenter = { repository.setCharacterPos(624f, 660f) }
                                )

                                RadarQuickActionsCard(
                                    onScanRoomClick = { activeScreen = "RoomScan" },
                                    onReportHazardClick = { activeScreen = "ReportHazard" },
                                    onEmergencyClick = { activeScreen = "Emergency" },
                                    onMessageSchoolClick = { activeScreen = "DRRM" }
                                )
                            }
                        }
                    }

                    "IndoorFloorPlan" -> {
                        val currentBldg = activeIndoorBuilding ?: buildings.first()
                        IndoorFloorPlanScreen(
                            building = currentBldg,
                            rooms = rooms,
                            onBackClick = { activeScreen = "MainDashboard" },
                            onRoomScanClick = { activeScreen = "RoomScan" }
                        )
                    }

                    "RoomScan" -> {
                        RoomScanScreen(
                            onBackClick = { activeScreen = "MainDashboard" },
                            onReportHazard = { activeScreen = "ReportHazard" }
                        )
                    }

                    "ReportHazard" -> {
                        ReportHazardScreen(
                            onBackClick = { activeScreen = "MainDashboard" },
                            onSubmitReport = { report ->
                                repository.addHazardReport(report)
                            }
                        )
                    }

                    "Emergency" -> {
                        EmergencyScreen(
                            onBackClick = { activeScreen = "MainDashboard" }
                        )
                    }

                    "Alerts" -> {
                        AlertsScreen(
                            alerts = alerts,
                            onBackClick = { activeScreen = "MainDashboard" }
                        )
                    }

                    "Routes" -> {
                        EvacuationRoutesScreen(
                            onBackClick = { activeScreen = "MainDashboard" }
                        )
                    }

                    "Profile" -> {
                        StudentProfileScreen(
                            profile = studentProfile,
                            onBackClick = { activeScreen = "MainDashboard" },
                            onSaveProfile = { updated -> repository.updateStudentProfile(updated) }
                        )
                    }

                    "DRRM" -> {
                        DRRMDashboardScreen(
                            onBackClick = { activeScreen = "MainDashboard" }
                        )
                    }
                }

                // Building Detail Slide-Up Bottom Sheet Overlay
                selectedBuilding?.let { building ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(DarkNavyBg.copy(alpha = 0.5f)),
                        contentAlignment = Alignment.BottomCenter
                    ) {
                        BuildingDetailBottomSheet(
                            building = building,
                            onDismiss = { repository.selectBuilding(null) },
                            onExploreIndoor = { b ->
                                activeIndoorBuilding = b
                                repository.selectBuilding(null)
                                activeScreen = "IndoorFloorPlan"
                            },
                            onFloorPlanClick = { b ->
                                activeIndoorBuilding = b
                                repository.selectBuilding(null)
                                activeScreen = "IndoorFloorPlan"
                            },
                            onHazardsClick = { b ->
                                repository.selectBuilding(null)
                                activeScreen = "ReportHazard"
                            },
                            onInspectClick = { b ->
                                repository.selectBuilding(null)
                                activeScreen = "RoomScan"
                            }
                        )
                    }
                }

                // Center Radial Menu Overlay
                RadarRadialMenu(
                    visible = isRadialMenuOpen,
                    onDismiss = { isRadialMenuOpen = false },
                    onActionSelected = { action ->
                        when (action) {
                            "Map" -> activeScreen = "MainDashboard"
                            "Scan" -> activeScreen = "RoomScan"
                            "Report Hazard" -> activeScreen = "ReportHazard"
                            "Emergency" -> activeScreen = "Emergency"
                        }
                    }
                )
            }
        }
    }
}
