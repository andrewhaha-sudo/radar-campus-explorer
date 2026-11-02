package com.radar.campusexplorer.ui.map

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.Building
import com.radar.campusexplorer.domain.model.PointF
import com.radar.campusexplorer.ui.theme.*
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun CampusMapCanvas(
    buildings: List<Building>,
    characterPos: PointF,
    activeLayer: String,
    onBuildingClick: (Building) -> Unit,
    onMoveCharacter: (Float, Float) -> Unit,
    onLayerToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    var zoomScale by remember { mutableFloatStateOf(1.0f) }

    // Pulsing animation for hazard markers & character pulse
    val infiniteTransition = rememberInfiniteTransition(label = "mapPulse")
    val hazardPulse by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "hazardPulse"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(16.dp))
            .background(DarkNavyBg)
            .border(2.dp, ElectricCyan, RoundedCornerShape(16.dp))
    ) {
        // Main Pixel Map Canvas
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures { offset ->
                        // Map touch to character target movement or building selection
                        val scale = zoomScale
                        val mapX = offset.x / scale
                        val mapY = offset.y / scale

                        // Check if tapped on a building
                        val tappedBuilding = buildings.find { b ->
                            mapX >= b.boundsLeft && mapX <= b.boundsLeft + b.boundsWidth &&
                                    mapY >= b.boundsTop && mapY <= b.boundsTop + b.boundsHeight
                        }

                        if (tappedBuilding != null) {
                            onBuildingClick(tappedBuilding)
                        } else {
                            // Move character towards tap location
                            val dx = (mapX - characterPos.x).coerceIn(-40f, 40f)
                            val dy = (mapY - characterPos.y).coerceIn(-40f, 40f)
                            onMoveCharacter(dx, dy)
                        }
                    }
                }
        ) {
            val canvasW = size.width
            val canvasH = size.height

            // 1. Draw Base Grass Field
            drawRect(
                color = MapGroundGreen,
                size = size
            )

            // Draw Decorative Trees and Grass Clumps
            drawDecorativeLandscape(canvasW, canvasH)

            // 2. Draw Walkway Network & Evacuation Routes
            drawWalkwaysAndRoutes(canvasW, canvasH, activeLayer)

            // 3. Draw Campus Pond & Gazebo
            drawPondAndGazebo(canvasW, canvasH)

            // 4. Draw School Buildings
            buildings.forEach { b ->
                drawBuildingOnCanvas(b, activeLayer, hazardPulse)
            }

            // 5. Draw Playable Student Character
            drawStudentCharacter(characterPos, hazardPulse)
        }

        // --- Header Banner over map ---
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 8.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            EmergencyRed,
                            CardNavyContainer
                        )
                    )
                )
                .border(1.5.dp, GoldenYellow, RoundedCornerShape(12.dp))
                .padding(horizontal = 16.dp, vertical = 4.dp)
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "SCHOOL EARTHQUAKE HAZARD MAP",
                    color = GoldenYellow,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "CAMPUS REGION – SAFETY ROUTE MAP",
                    color = TextWhite,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // --- Compass Rose (Top Right) ---
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 10.dp, end = 12.dp)
                .size(44.dp)
                .clip(CircleShape)
                .background(CardNavyContainer.copy(alpha = 0.9f))
                .border(1.5.dp, ElectricCyan, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(36.dp)) {
                val center = Offset(size.width / 2f, size.height / 2f)
                // Draw N S E W arrows
                drawLine(
                    color = EmergencyRed,
                    start = center,
                    end = Offset(center.x, center.y - 14f),
                    strokeWidth = 3f
                )
                drawLine(
                    color = ElectricCyan,
                    start = center,
                    end = Offset(center.x, center.y + 14f),
                    strokeWidth = 2f
                )
                drawLine(
                    color = ElectricCyan,
                    start = center,
                    end = Offset(center.x + 14f, center.y),
                    strokeWidth = 2f
                )
                drawLine(
                    color = ElectricCyan,
                    start = center,
                    end = Offset(center.x - 14f, center.y),
                    strokeWidth = 2f
                )
            }
            Text(
                text = "N",
                color = EmergencyRed,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.align(Alignment.TopCenter).padding(top = 2.dp)
            )
        }

        // --- Bottom Legend Overlay ---
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 12.dp, bottom = 12.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(CardNavyContainer.copy(alpha = 0.95f))
                .border(1.dp, VioletPurple, RoundedCornerShape(12.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(VioletPurple)
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "LEGEND",
                        color = TextWhite,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                LegendItem(label = "Evacuation Route", color = VioletPurple)
                LegendItem(label = "Designated Safe Open Area (Covered Court)", color = EmeraldGreen)
                LegendItem(label = "Walkway", color = MapPathwayGray)
                LegendItem(label = "Building", color = GoldenYellow)
            }
        }

        // --- Floating Map Controls (Right Side) ---
        Column(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            MapControlButton(
                icon = Icons.Default.Layers,
                label = "Layer: $activeLayer",
                onClick = onLayerToggle
            )
            MapControlButton(
                icon = Icons.Default.Add,
                label = "Zoom In",
                onClick = { zoomScale = (zoomScale + 0.15f).coerceAtMost(2.0f) }
            )
            MapControlButton(
                icon = Icons.Default.Remove,
                label = "Zoom Out",
                onClick = { zoomScale = (zoomScale - 0.15f).coerceAtLeast(0.7f) }
            )
            MapControlButton(
                icon = Icons.Default.MyLocation,
                label = "Recenter",
                onClick = { onMoveCharacter(0f, 0f) }
            )
        }

        // --- D-Pad Touch Controller (Bottom Right) ---
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 12.dp, bottom = 12.dp)
        ) {
            DPadController(
                onMove = onMoveCharacter
            )
        }
    }
}

@Composable
private fun LegendItem(label: String, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(color)
        )
        Text(
            text = label,
            color = TextWhite,
            fontSize = 8.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun MapControlButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(CardNavyContainer)
            .border(1.dp, ElectricCyan, RoundedCornerShape(10.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = ElectricCyan,
            modifier = Modifier.size(18.dp)
        )
    }
}

@Composable
private fun DPadController(
    onMove: (Float, Float) -> Unit
) {
    Box(
        modifier = Modifier
            .size(80.dp)
            .clip(CircleShape)
            .background(CardNavyContainer.copy(alpha = 0.85f))
            .border(1.5.dp, GoldenYellow, CircleShape)
    ) {
        // Up
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .size(26.dp)
                .clickable { onMove(0f, -30f) },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.KeyboardArrowUp, "Up", tint = GoldenYellow)
        }
        // Down
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .size(26.dp)
                .clickable { onMove(0f, 30f) },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.KeyboardArrowDown, "Down", tint = GoldenYellow)
        }
        // Left
        Box(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .size(26.dp)
                .clickable { onMove(-30f, 0f) },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.KeyboardArrowLeft, "Left", tint = GoldenYellow)
        }
        // Right
        Box(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .size(26.dp)
                .clickable { onMove(30f, 0f) },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.KeyboardArrowRight, "Right", tint = GoldenYellow)
        }
    }
}

private fun DrawScope.drawDecorativeLandscape(canvasW: Float, canvasH: Float) {
    val treeGreen = Color(0xFF2E8B40)
    val darkTree = Color(0xFF1E5B2A)

    // Cluster of trees around campus perimeters
    val treePositions = listOf(
        Offset(canvasW * 0.05f, canvasH * 0.2f),
        Offset(canvasW * 0.08f, canvasH * 0.45f),
        Offset(canvasW * 0.05f, canvasH * 0.7f),
        Offset(canvasW * 0.92f, canvasH * 0.25f),
        Offset(canvasW * 0.94f, canvasH * 0.6f),
        Offset(canvasW * 0.5f, canvasH * 0.85f),
        Offset(canvasW * 0.7f, canvasH * 0.85f)
    )

    treePositions.forEach { pos ->
        drawCircle(color = darkTree, radius = 18f, center = pos)
        drawCircle(color = treeGreen, radius = 15f, center = Offset(pos.x - 2f, pos.y - 2f))
    }
}

private fun DrawScope.drawWalkwaysAndRoutes(canvasW: Float, canvasH: Float, activeLayer: String) {
    // Primary Walkway grid (Gray)
    drawRect(
        color = MapPathwayGray,
        topLeft = Offset(canvasW * 0.05f, canvasH * 0.42f),
        size = Size(canvasW * 0.9f, 24f)
    )

    drawRect(
        color = MapPathwayGray,
        topLeft = Offset(canvasW * 0.22f, canvasH * 0.42f),
        size = Size(20f, canvasH * 0.4f)
    )

    drawRect(
        color = MapPathwayGray,
        topLeft = Offset(canvasW * 0.78f, canvasH * 0.42f),
        size = Size(20f, canvasH * 0.4f)
    )

    // If Safety Routes layer is enabled, draw Purple Evacuation Lines
    if (activeLayer == "Routes" || activeLayer == "Campus" || activeLayer == "Hazards") {
        val routePath = Path().apply {
            moveTo(canvasW * 0.12f, canvasH * 0.43f)
            lineTo(canvasW * 0.52f, canvasH * 0.43f)
            lineTo(canvasW * 0.52f, canvasH * 0.58f)
        }

        drawPath(
            path = routePath,
            color = VioletPurple,
            style = Stroke(
                width = 8f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(15f, 10f), 0f)
            )
        )
    }
}

private fun DrawScope.drawPondAndGazebo(canvasW: Float, canvasH: Float) {
    val waterBlue = Color(0xFF38BDF8)
    val pondBorder = Color(0xFF0284C7)

    // Pond
    drawOval(
        color = pondBorder,
        topLeft = Offset(canvasW * 0.12f, canvasH * 0.52f),
        size = Size(canvasW * 0.08f, canvasH * 0.18f)
    )
    drawOval(
        color = waterBlue,
        topLeft = Offset(canvasW * 0.125f, canvasH * 0.53f),
        size = Size(canvasW * 0.07f, canvasH * 0.16f)
    )
}

private fun DrawScope.drawBuildingOnCanvas(
    b: Building,
    activeLayer: String,
    pulse: Float
) {
    val baseRoofColor = when (b.id) {
        "court" -> MapRoofBlue
        "lab" -> Color(0xFFE56A54)
        else -> MapRoofYellow
    }

    val buildingTopLeft = Offset(b.boundsLeft, b.boundsTop)
    val buildingSize = Size(b.boundsWidth, b.boundsHeight)

    // Building Drop Shadow
    drawRoundRect(
        color = Color.Black.copy(alpha = 0.3f),
        topLeft = Offset(b.boundsLeft + 4f, b.boundsTop + 6f),
        size = buildingSize,
        cornerRadius = CornerRadius(8f)
    )

    // Building Main Structure
    drawRoundRect(
        color = baseRoofColor,
        topLeft = buildingTopLeft,
        size = buildingSize,
        cornerRadius = CornerRadius(8f)
    )

    // Building Border Outline
    drawRoundRect(
        color = Color(0xFF1E293B),
        topLeft = buildingTopLeft,
        size = buildingSize,
        cornerRadius = CornerRadius(8f),
        style = Stroke(width = 3f)
    )

    // Building Name Label Badge
    val labelText = b.label
    drawRoundRect(
        color = Color.White,
        topLeft = Offset(b.boundsLeft + 8f, b.boundsTop + 8f),
        size = Size(b.boundsWidth - 16f, 22f),
        cornerRadius = CornerRadius(4f)
    )

    // If building has hazards, draw glowing hazard icon marker
    if (b.reportedHazards > 0) {
        val hazardCenter = Offset(b.boundsLeft + b.boundsWidth / 2f, b.boundsTop + b.boundsHeight / 2f)
        drawCircle(
            color = EmergencyRed.copy(alpha = 0.4f * pulse),
            radius = 18f * pulse,
            center = hazardCenter
        )
        drawCircle(
            color = EmergencyRed,
            radius = 10f,
            center = hazardCenter
        )
    }
}

private fun DrawScope.drawStudentCharacter(pos: PointF, pulse: Float) {
    val charCenter = Offset(pos.x, pos.y)

    // Character position ring
    drawCircle(
        color = ElectricCyan.copy(alpha = 0.3f * pulse),
        radius = 20f * pulse,
        center = charCenter
    )

    // Character body circle (Avatar sprite representation)
    drawCircle(
        color = GoldenYellow,
        radius = 12f,
        center = charCenter
    )
    drawCircle(
        color = DarkNavyBg,
        radius = 12f,
        center = charCenter,
        style = Stroke(width = 2f)
    )

    // Direction arrow pointer
    drawCircle(
        color = ElectricCyan,
        radius = 4f,
        center = Offset(pos.x, pos.y - 14f)
    )
}
