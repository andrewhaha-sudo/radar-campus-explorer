package com.radar.campusexplorer.ui.components

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
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.PointF
import com.radar.campusexplorer.ui.theme.*

@Composable
fun RadarMiniMapCard(
    characterPos: PointF,
    onZoomIn: () -> Unit,
    onZoomOut: () -> Unit,
    onRecenter: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .width(220.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        CardNavyContainer,
                        DarkNavyBg
                    )
                )
            )
            .border(1.5.dp, ElectricCyan, RoundedCornerShape(16.dp))
            .padding(8.dp)
    ) {
        // Mini Map Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(EmeraldGreen)
                )
                Text(
                    text = "Mini Map",
                    color = TextWhite,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = "Close Mini Map",
                tint = TextMutedBlue,
                modifier = Modifier.size(14.dp)
            )
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Mini Map Canvas Box
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(110.dp)
                .clip(RoundedCornerShape(10.dp))
                .border(1.dp, ElectricCyan.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val canvasWidth = size.width
                val canvasHeight = size.height

                // Draw Ground
                drawRect(
                    color = MapGroundGreen,
                    size = size
                )

                // Draw Buildings Mini Rectangles
                // Bldg C
                drawRoundRect(
                    color = MapRoofYellow,
                    topLeft = Offset(canvasWidth * 0.1f, canvasHeight * 0.15f),
                    size = Size(canvasWidth * 0.22f, canvasHeight * 0.2f),
                    cornerRadius = CornerRadius(4f)
                )

                // Chemistry Lab
                drawRoundRect(
                    color = Color(0xFFE56A54),
                    topLeft = Offset(canvasWidth * 0.35f, canvasHeight * 0.18f),
                    size = Size(canvasWidth * 0.18f, canvasHeight * 0.18f),
                    cornerRadius = CornerRadius(4f)
                )

                // Bldg B
                drawRoundRect(
                    color = MapRoofYellow,
                    topLeft = Offset(canvasWidth * 0.56f, canvasHeight * 0.15f),
                    size = Size(canvasWidth * 0.22f, canvasHeight * 0.2f),
                    cornerRadius = CornerRadius(4f)
                )

                // Covered Court
                drawRoundRect(
                    color = MapRoofBlue,
                    topLeft = Offset(canvasWidth * 0.35f, canvasHeight * 0.5f),
                    size = Size(canvasWidth * 0.3f, canvasHeight * 0.3f),
                    cornerRadius = CornerRadius(6f)
                )

                // Walkways
                drawRect(
                    color = MapPathwayGray,
                    topLeft = Offset(0f, canvasHeight * 0.42f),
                    size = Size(canvasWidth, canvasHeight * 0.08f)
                )

                // Character Location Marker (Cyan Triangle Pointer)
                val relX = (characterPos.x / 1300f).coerceIn(0.1f, 0.9f) * canvasWidth
                val relY = (characterPos.y / 850f).coerceIn(0.1f, 0.9f) * canvasHeight

                val arrowPath = Path().apply {
                    moveTo(relX, relY - 10f)
                    lineTo(relX - 7f, relY + 8f)
                    lineTo(relX, relY + 4f)
                    lineTo(relX + 7f, relY + 8f)
                    close()
                }

                drawPath(
                    path = arrowPath,
                    color = ElectricCyan
                )

                // Marker outer glow circle
                drawCircle(
                    color = ElectricCyan.copy(alpha = 0.4f),
                    radius = 12f,
                    center = Offset(relX, relY)
                )
            }

            // Floating Controls on right side of mini map
            Column(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(CardNavyContainer)
                        .border(1.dp, ElectricCyan, RoundedCornerShape(4.dp))
                        .clickable { onZoomIn() },
                    contentAlignment = Alignment.Center
                ) {
                    Text("+", color = TextWhite, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(CardNavyContainer)
                        .border(1.dp, ElectricCyan, RoundedCornerShape(4.dp))
                        .clickable { onZoomOut() },
                    contentAlignment = Alignment.Center
                ) {
                    Text("-", color = TextWhite, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(CardNavyContainer)
                        .border(1.dp, ElectricCyan, RoundedCornerShape(4.dp))
                        .clickable { onRecenter() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.MyLocation,
                        contentDescription = "Recenter",
                        tint = ElectricCyan,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }
        }
    }
}
