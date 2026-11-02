package com.radar.campusexplorer.ui.components

import androidx.compose.animation.*
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
fun RadarRadialMenu(
    visible: Boolean,
    onDismiss: () -> Unit,
    onActionSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn() + scaleIn(),
        exit = fadeOut() + scaleOut()
    ) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.5f))
                .clickable { onDismiss() },
            contentAlignment = Alignment.BottomCenter
        ) {
            Box(
                modifier = Modifier
                    .padding(bottom = 70.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                CardNavyContainer,
                                DarkNavyBg
                            )
                        )
                    )
                    .border(2.dp, GoldenYellow, RoundedCornerShape(24.dp))
                    .padding(16.dp)
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "RADAR Quick Command",
                        color = GoldenYellow,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        RadialItem(
                            label = "Explore Map",
                            icon = Icons.Default.Explore,
                            color = ElectricCyan,
                            onClick = {
                                onActionSelected("Map")
                                onDismiss()
                            }
                        )

                        RadialItem(
                            label = "Scan Room",
                            icon = Icons.Default.CameraAlt,
                            color = GoldenYellow,
                            onClick = {
                                onActionSelected("Scan")
                                onDismiss()
                            }
                        )

                        RadialItem(
                            label = "Report Hazard",
                            icon = Icons.Default.Warning,
                            color = EmergencyRed,
                            onClick = {
                                onActionSelected("Report Hazard")
                                onDismiss()
                            }
                        )

                        RadialItem(
                            label = "SOS Contacts",
                            icon = Icons.Default.PhoneInTalk,
                            color = VioletPurple,
                            onClick = {
                                onActionSelected("Emergency")
                                onDismiss()
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RadialItem(
    label: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.2f))
                .border(2.dp, color, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = color,
                modifier = Modifier.size(24.dp)
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            color = TextWhite,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
