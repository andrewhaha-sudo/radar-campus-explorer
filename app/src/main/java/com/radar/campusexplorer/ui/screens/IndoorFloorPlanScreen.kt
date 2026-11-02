package com.radar.campusexplorer.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.Building
import com.radar.campusexplorer.domain.model.Room
import com.radar.campusexplorer.ui.components.ButtonStyle
import com.radar.campusexplorer.ui.components.RadarGameButton
import com.radar.campusexplorer.ui.theme.*

@Composable
fun IndoorFloorPlanScreen(
    building: Building,
    rooms: List<Room>,
    onBackClick: () -> Unit,
    onRoomScanClick: (Room) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedFloor by remember { mutableIntStateOf(1) }
    var selectedRoom by remember { mutableStateOf<Room?>(null) }

    val floorRooms = rooms.filter { it.buildingId == building.id && it.floor == selectedFloor }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavyBg)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Top Navigation Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadarGameButton(
                text = "Back to Campus",
                icon = Icons.Default.ArrowBack,
                onClick = onBackClick,
                style = ButtonStyle.NAVY
            )

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "${building.name} — Floor Plan",
                    color = TextWhite,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "Indoor Exploration & Safety Verification",
                    color = TextMutedBlue,
                    fontSize = 10.sp
                )
            }

            // Floor Selector Switcher
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                (1..building.floors).forEach { floorNum ->
                    RadarGameButton(
                        text = "Floor $floorNum",
                        isSelected = selectedFloor == floorNum,
                        onClick = { selectedFloor = floorNum },
                        style = if (selectedFloor == floorNum) ButtonStyle.GOLD else ButtonStyle.NAVY,
                        height = 36.dp
                    )
                }
            }
        }

        // Indoor Floor Plan Layout Viewport
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(16.dp))
                .background(CardNavyContainer)
                .border(2.dp, ElectricCyan, RoundedCornerShape(16.dp))
                .padding(16.dp)
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val canvasWidth = size.width
                val canvasHeight = size.height

                // Draw Corridor Floor
                drawRoundRect(
                    color = Color(0xFF1B326B),
                    topLeft = Offset(canvasWidth * 0.05f, canvasHeight * 0.1f),
                    size = Size(canvasWidth * 0.9f, canvasHeight * 0.8f),
                    cornerRadius = CornerRadius(12f)
                )

                // Draw Central Hallway
                drawRect(
                    color = Color(0xFF2B478E),
                    topLeft = Offset(canvasWidth * 0.1f, canvasHeight * 0.45f),
                    size = Size(canvasWidth * 0.8f, canvasHeight * 0.1f)
                )

                // Draw Rooms along top and bottom of hallway
                val topRoomWidth = canvasWidth * 0.22f
                val roomHeight = canvasHeight * 0.3f

                (0..3).forEach { index ->
                    val rx = canvasWidth * (0.12f + index * 0.2f)

                    // Top Room
                    drawRoundRect(
                        color = Color(0xFF132859),
                        topLeft = Offset(rx, canvasHeight * 0.13f),
                        size = Size(topRoomWidth, roomHeight),
                        cornerRadius = CornerRadius(8f)
                    )
                    drawRoundRect(
                        color = ElectricCyan,
                        topLeft = Offset(rx, canvasHeight * 0.13f),
                        size = Size(topRoomWidth, roomHeight),
                        cornerRadius = CornerRadius(8f),
                        style = Stroke(width = 2f)
                    )

                    // Door Indicator
                    drawRect(
                        color = GoldenYellow,
                        topLeft = Offset(rx + topRoomWidth / 2f - 12f, canvasHeight * 0.43f),
                        size = Size(24f, 8f)
                    )

                    // Bottom Room
                    drawRoundRect(
                        color = Color(0xFF132859),
                        topLeft = Offset(rx, canvasHeight * 0.57f),
                        size = Size(topRoomWidth, roomHeight),
                        cornerRadius = CornerRadius(8f)
                    )
                    drawRoundRect(
                        color = ElectricCyan,
                        topLeft = Offset(rx, canvasHeight * 0.57f),
                        size = Size(topRoomWidth, roomHeight),
                        cornerRadius = CornerRadius(8f),
                        style = Stroke(width = 2f)
                    )

                    // Door Indicator
                    drawRect(
                        color = GoldenYellow,
                        topLeft = Offset(rx + topRoomWidth / 2f - 12f, canvasHeight * 0.56f),
                        size = Size(24f, 8f)
                    )
                }
            }

            // Room Selector List overlay
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(8.dp)
            ) {
                Text(
                    text = "Classrooms on Floor $selectedFloor:",
                    color = GoldenYellow,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    floorRooms.forEach { room ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (selectedRoom?.id == room.id) GoldenYellow else DarkNavyBg)
                                .border(1.dp, ElectricCyan, RoundedCornerShape(8.dp))
                                .clickable { selectedRoom = room }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = room.name,
                                color = if (selectedRoom?.id == room.id) TextDarkNavy else TextWhite,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        // Room Detail Card (If Room Selected)
        selectedRoom?.let { room ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(CardNavyContainer)
                    .border(1.dp, GoldenYellow, RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = room.name,
                            color = TextWhite,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Floor ${room.floor} · Door Status: Verified Clear · Inspection: Passed",
                            color = EmeraldGreen,
                            fontSize = 10.sp
                        )
                    }

                    RadarGameButton(
                        text = "Scan with AI",
                        icon = Icons.Default.CameraAlt,
                        style = ButtonStyle.CYAN,
                        onClick = { onRoomScanClick(room) }
                    )
                }
            }
        }
    }
}
