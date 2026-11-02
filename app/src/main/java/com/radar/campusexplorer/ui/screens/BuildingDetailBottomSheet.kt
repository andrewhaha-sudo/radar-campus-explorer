package com.radar.campusexplorer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.Building
import com.radar.campusexplorer.ui.components.ButtonStyle
import com.radar.campusexplorer.ui.components.RadarGameButton
import com.radar.campusexplorer.ui.theme.*

@Composable
fun BuildingDetailBottomSheet(
    building: Building,
    onDismiss: () -> Unit,
    onExploreIndoor: (Building) -> Unit,
    onFloorPlanClick: (Building) -> Unit,
    onHazardsClick: (Building) -> Unit,
    onInspectClick: (Building) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        CardNavyContainer,
                        DarkNavyBg
                    )
                )
            )
            .border(2.dp, ElectricCyan, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
            .padding(16.dp)
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Drag Handle Bar & Close
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Business,
                        contentDescription = "Building",
                        tint = GoldenYellow,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = building.name,
                        color = TextWhite,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(EmeraldGreen.copy(alpha = 0.2f))
                        .border(1.dp, EmeraldGreen, RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = building.verifiedStatus,
                        color = EmeraldGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Text(
                text = building.description,
                color = TextMutedBlue,
                fontSize = 12.sp,
                lineHeight = 16.sp
            )

            // Info Metrics Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                MetricChip("Floors", "${building.floors} Levels", Icons.Default.Stairs)
                MetricChip("Rooms", "${building.roomCount} Rooms", Icons.Default.DoorFront)
                MetricChip("Hazards", "${building.reportedHazards} Active", Icons.Default.Warning)
                MetricChip("Last Check", building.lastInspectionDate, Icons.Default.EventAvailable)
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(ElectricCyan.copy(alpha = 0.3f))
            )

            // 4 Game-Style Action Buttons: EXPLORE, FLOOR PLAN, HAZARDS, INSPECT
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                RadarGameButton(
                    text = "EXPLORE",
                    icon = Icons.Default.Explore,
                    style = ButtonStyle.GOLD,
                    onClick = { onExploreIndoor(building) },
                    modifier = Modifier.weight(1f)
                )

                RadarGameButton(
                    text = "FLOOR PLAN",
                    icon = Icons.Default.Map,
                    style = ButtonStyle.CYAN,
                    onClick = { onFloorPlanClick(building) },
                    modifier = Modifier.weight(1f)
                )

                RadarGameButton(
                    text = "HAZARDS",
                    icon = Icons.Default.Warning,
                    style = ButtonStyle.RED,
                    onClick = { onHazardsClick(building) },
                    modifier = Modifier.weight(1f)
                )

                RadarGameButton(
                    text = "INSPECT",
                    icon = Icons.Default.CheckCircle,
                    style = ButtonStyle.GREEN,
                    onClick = { onInspectClick(building) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun MetricChip(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(DarkNavyBg)
            .border(1.dp, TextMutedBlue.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 6.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = ElectricCyan,
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = value,
                color = TextWhite,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = label,
                color = TextMutedBlue,
                fontSize = 9.sp
            )
        }
    }
}
