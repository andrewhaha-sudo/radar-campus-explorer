package com.radar.campusexplorer.ui.screens

import androidx.compose.foundation.Canvas
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
import com.radar.campusexplorer.ui.components.ButtonStyle
import com.radar.campusexplorer.ui.components.RadarGameButton
import com.radar.campusexplorer.ui.theme.*

@Composable
fun RoomScanScreen(
    onBackClick: () -> Unit,
    onReportHazard: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isScanning by remember { mutableStateOf(true) }
    var scanScore by remember { mutableIntStateOf(94) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavyBg)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Top Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadarGameButton(
                text = "Back",
                icon = Icons.Default.ArrowBack,
                onClick = onBackClick,
                style = ButtonStyle.NAVY
            )

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "RADAR AI Room Inspection",
                    color = ElectricCyan,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "Structural Hazard & Exit Clearance Scanner",
                    color = TextMutedBlue,
                    fontSize = 10.sp
                )
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(EmeraldGreen.copy(alpha = 0.2f))
                    .border(1.dp, EmeraldGreen, RoundedCornerShape(12.dp))
                    .padding(horizontal = 10.dp, vertical = 5.dp)
            ) {
                Text(
                    text = "AI ACTIVE",
                    color = EmeraldGreen,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // Camera Preview & AI Bounding Box Canvas
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF071030))
                .border(2.dp, ElectricCyan, RoundedCornerShape(16.dp))
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val cw = size.width
                val ch = size.height

                // Draw Camera Grid Lines
                drawLine(
                    color = ElectricCyan.copy(alpha = 0.2f),
                    start = Offset(cw * 0.33f, 0f),
                    end = Offset(cw * 0.33f, ch),
                    strokeWidth = 1f
                )
                drawLine(
                    color = ElectricCyan.copy(alpha = 0.2f),
                    start = Offset(cw * 0.66f, 0f),
                    end = Offset(cw * 0.66f, ch),
                    strokeWidth = 1f
                )

                // AI Bounding Box 1: Emergency Door Clearance
                drawRoundRect(
                    color = EmeraldGreen,
                    topLeft = Offset(cw * 0.15f, ch * 0.25f),
                    size = Size(cw * 0.35f, ch * 0.5f),
                    cornerRadius = CornerRadius(8f),
                    style = Stroke(width = 3f)
                )

                // AI Bounding Box 2: Wall Column Integrity Check
                drawRoundRect(
                    color = GoldenYellow,
                    topLeft = Offset(cw * 0.55f, ch * 0.2f),
                    size = Size(cw * 0.3f, ch * 0.4f),
                    cornerRadius = CornerRadius(8f),
                    style = Stroke(width = 3f)
                )

                // Scanning Target Reticle in Center
                drawCircle(
                    color = ElectricCyan.copy(alpha = 0.4f),
                    radius = 40f,
                    center = Offset(cw / 2f, ch / 2f),
                    style = Stroke(width = 2f)
                )
            }

            // Target Labels
            Box(
                modifier = Modifier
                    .offset(x = 30.dp, y = 40.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(EmeraldGreen)
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = "Exit Door: CLEAR (98%)",
                    color = TextDarkNavy,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Box(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .offset(x = (-40).dp, y = (-20).dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(GoldenYellow)
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = "Column: NO CRACKS DETECTED",
                    color = TextDarkNavy,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Bottom Scan Controls
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadarGameButton(
                    text = "Capture Scan",
                    icon = Icons.Default.Camera,
                    style = ButtonStyle.GOLD,
                    onClick = {
                        isScanning = false
                        scanScore = 96
                    }
                )

                RadarGameButton(
                    text = "Report Found Hazard",
                    icon = Icons.Default.Warning,
                    style = ButtonStyle.RED,
                    onClick = onReportHazard
                )
            }
        }

        // Inspection Result Panel
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(CardNavyContainer)
                .border(1.dp, ElectricCyan, RoundedCornerShape(12.dp))
                .padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Safety Inspection Score: $scanScore / 100",
                        color = EmeraldGreen,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "Building C - Room 101 · All emergency paths verified clear.",
                        color = TextWhite,
                        fontSize = 11.sp
                    )
                }

                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(EmeraldGreen),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Check, "Passed", tint = TextDarkNavy)
                }
            }
        }
    }
}
