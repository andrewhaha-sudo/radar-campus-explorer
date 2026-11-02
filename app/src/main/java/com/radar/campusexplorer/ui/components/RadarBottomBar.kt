package com.radar.campusexplorer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.ui.theme.*

@Composable
fun RadarBottomBar(
    activeTab: String,
    onTabSelected: (String) -> Unit,
    onCenterRadarClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(64.dp)
            .background(DarkNavyBg),
        contentAlignment = Alignment.BottomCenter
    ) {
        // Main Navigation Bar Container
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            DeepRoyalBlue,
                            DarkNavyBg
                        )
                    )
                )
                .border(
                    width = 1.5.dp,
                    brush = Brush.horizontalGradient(
                        colors = listOf(ElectricCyan, CyanGlow, ElectricCyan)
                    ),
                    shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
                )
                .padding(horizontal = 8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Left 4 Tabs
                BottomNavItem("Map", Icons.Default.Map, activeTab == "Map") { onTabSelected("Map") }
                BottomNavItem("Inspect", Icons.Default.Search, activeTab == "Inspect") { onTabSelected("Inspect") }
                BottomNavItem("Scan", Icons.Default.CameraAlt, activeTab == "Scan") { onTabSelected("Scan") }
                BottomNavItem("Alerts", Icons.Default.Notifications, activeTab == "Alerts", badgeCount = 3) { onTabSelected("Alerts") }

                // Center Spacer for elevated button
                Spacer(modifier = Modifier.width(52.dp))

                // Right 4 Tabs
                BottomNavItem("Routes", Icons.Default.DirectionsRun, activeTab == "Routes") { onTabSelected("Routes") }
                BottomNavItem("Students", Icons.Default.Groups, activeTab == "Students") { onTabSelected("Students") }
                BottomNavItem("Resources", Icons.Default.Inventory2, activeTab == "Resources") { onTabSelected("Resources") }
                BottomNavItem("Settings", Icons.Default.Settings, activeTab == "Settings") { onTabSelected("Settings") }
            }
        }

        // Elevated Circular Center RADAR Action Button
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = (-10).dp)
                .size(56.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            ElectricCyan,
                            DeepRoyalBlue,
                            DarkNavyBg
                        )
                    )
                )
                .border(2.5.dp, GoldenYellow, CircleShape)
                .clickable { onCenterRadarClick() },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Radar,
                contentDescription = "Center RADAR Action",
                tint = GoldenYellow,
                modifier = Modifier.size(32.dp)
            )
        }
    }
}

@Composable
private fun BottomNavItem(
    label: String,
    icon: ImageVector,
    isSelected: Boolean,
    badgeCount: Int = 0,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (isSelected) GoldenYellow else Color.Transparent
            )
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = if (isSelected) TextDarkNavy else TextWhite,
                    modifier = Modifier.size(20.dp)
                )
                if (badgeCount > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 6.dp, y = (-4).dp)
                            .size(14.dp)
                            .clip(CircleShape)
                            .background(EmergencyRed),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = badgeCount.toString(),
                            color = TextWhite,
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
            Text(
                text = label,
                color = if (isSelected) TextDarkNavy else TextMutedBlue,
                fontSize = 9.sp,
                fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium
            )
        }
    }
}
