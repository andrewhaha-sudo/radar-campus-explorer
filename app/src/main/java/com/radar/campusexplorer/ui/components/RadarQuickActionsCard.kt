package com.radar.campusexplorer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.ui.theme.*

@Composable
fun RadarQuickActionsCard(
    onScanRoomClick: () -> Unit,
    onReportHazardClick: () -> Unit,
    onEmergencyClick: () -> Unit,
    onMessageSchoolClick: () -> Unit,
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
                        .size(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(ElectricCyan)
                )
                Text(
                    text = "Quick Actions",
                    color = TextWhite,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            QuickActionButtonItem(
                label = "Scan Room",
                icon = Icons.Default.CameraAlt,
                topColor = ElectricCyan,
                bottomColor = CyanGlow,
                textColor = TextDarkNavy,
                onClick = onScanRoomClick
            )

            QuickActionButtonItem(
                label = "Report Hazard",
                icon = Icons.Default.Warning,
                topColor = GoldenYellow,
                bottomColor = GoldDark,
                textColor = TextDarkNavy,
                onClick = onReportHazardClick
            )

            QuickActionButtonItem(
                label = "SOS Emergency",
                icon = Icons.Default.Phone,
                topColor = EmergencyRed,
                bottomColor = RedGlow,
                textColor = TextWhite,
                onClick = onEmergencyClick
            )

            QuickActionButtonItem(
                label = "Message School",
                icon = Icons.Default.Email,
                topColor = VioletPurple,
                bottomColor = PurpleDark,
                textColor = TextWhite,
                onClick = onMessageSchoolClick
            )
        }
    }
}

@Composable
private fun QuickActionButtonItem(
    label: String,
    icon: ImageVector,
    topColor: Color,
    bottomColor: Color,
    textColor: Color,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(46.dp)
            .clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(topColor, bottomColor)
                    )
                )
                .border(1.dp, Color.White.copy(alpha = 0.5f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = textColor,
                modifier = Modifier.size(20.dp)
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = label,
            color = TextWhite,
            fontSize = 8.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 2,
            lineHeight = 10.sp
        )
    }
}
