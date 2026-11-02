package com.radar.campusexplorer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import com.radar.campusexplorer.ui.theme.*

@Composable
fun RadarDrawer(
    activeDestination: String,
    onNavigate: (String) -> Unit,
    onEmergencyClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .width(200.dp)
            .fillMaxHeight()
            .clip(RoundedCornerShape(topEnd = 16.dp, bottomEnd = 16.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        DarkNavyBg,
                        CardNavyContainer,
                        DarkNavyBg
                    )
                )
            )
            .border(
                width = 1.5.dp,
                brush = Brush.verticalGradient(
                    colors = listOf(ElectricCyan, CyanGlow, ElectricCyan)
                ),
                shape = RoundedCornerShape(topEnd = 16.dp, bottomEnd = 16.dp)
            )
            .padding(12.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                RadarGameButton(
                    text = "Campus Map",
                    icon = Icons.Default.Map,
                    isSelected = activeDestination == "Campus Map",
                    onClick = { onNavigate("Campus Map") },
                    style = ButtonStyle.GOLD,
                    modifier = Modifier.fillMaxWidth()
                )

                RadarGameButton(
                    text = "Hazard Map",
                    icon = Icons.Default.Layers,
                    isSelected = activeDestination == "Hazard Map",
                    onClick = { onNavigate("Hazard Map") },
                    style = ButtonStyle.BLUE,
                    modifier = Modifier.fillMaxWidth()
                )

                RadarGameButton(
                    text = "Room Scan (AI)",
                    icon = Icons.Default.CameraAlt,
                    isSelected = activeDestination == "Room Scan",
                    onClick = { onNavigate("Room Scan") },
                    style = ButtonStyle.CYAN,
                    modifier = Modifier.fillMaxWidth()
                )

                RadarGameButton(
                    text = "Alerts & Updates",
                    icon = Icons.Default.Notifications,
                    badgeCount = 3,
                    isSelected = activeDestination == "Alerts",
                    onClick = { onNavigate("Alerts") },
                    style = ButtonStyle.BLUE,
                    modifier = Modifier.fillMaxWidth()
                )

                RadarGameButton(
                    text = "Evacuation Routes",
                    icon = Icons.Default.DirectionsRun,
                    isSelected = activeDestination == "Routes",
                    onClick = { onNavigate("Routes") },
                    style = ButtonStyle.GREEN,
                    modifier = Modifier.fillMaxWidth()
                )

                RadarGameButton(
                    text = "My Profile",
                    icon = Icons.Default.Badge,
                    isSelected = activeDestination == "Profile",
                    onClick = { onNavigate("Profile") },
                    style = ButtonStyle.PURPLE,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Bottom Emergency Button
            RadarGameButton(
                text = "Emergency",
                icon = Icons.Default.Phone,
                onClick = onEmergencyClick,
                style = ButtonStyle.RED,
                height = 50.dp,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
