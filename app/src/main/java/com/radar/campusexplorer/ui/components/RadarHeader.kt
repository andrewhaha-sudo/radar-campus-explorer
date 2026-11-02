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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.StudentProfile
import com.radar.campusexplorer.ui.theme.*

@Composable
fun RadarHeader(
    studentProfile: StudentProfile,
    onNotificationsClick: () -> Unit,
    onProfileClick: () -> Unit,
    onSchoolSelectClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.horizontalGradient(
                    colors = listOf(
                        DarkNavyBg,
                        DeepRoyalBlue,
                        DarkNavyBg
                    )
                )
            )
            .border(
                width = 1.dp,
                brush = Brush.horizontalGradient(
                    colors = listOf(ElectricCyan.copy(alpha = 0.3f), ElectricCyan, ElectricCyan.copy(alpha = 0.3f))
                ),
                shape = RoundedCornerShape(0.dp)
            )
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left: RADAR Branding
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Pokéball / Radar Emblem
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(EmergencyRed, DarkNavyBg, ElectricCyan)
                            )
                        )
                        .border(1.5.dp, ElectricCyan, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Radar,
                        contentDescription = "RADAR Emblem",
                        tint = ElectricCyan,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "RADAR",
                            color = TextWhite,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.5.sp
                        )
                    }
                    Text(
                        text = "Real-time AI-Powered Disaster Awareness",
                        color = TextMutedBlue,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Middle: School Selector, Safety Status, Calendar Date/Time
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // School Selector Pill
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(CardNavyContainer)
                        .border(1.dp, ElectricCyan, RoundedCornerShape(16.dp))
                        .clickable { onSchoolSelectClick() }
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.School,
                            contentDescription = "School Icon",
                            tint = GoldenYellow,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = studentProfile.schoolName,
                            color = TextWhite,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Icon(
                            imageVector = Icons.Default.ArrowDropDown,
                            contentDescription = "Select School",
                            tint = TextWhite,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                // Safety Status Badge Pill
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(EmeraldGreen.copy(alpha = 0.2f))
                        .border(1.dp, EmeraldGreen, RoundedCornerShape(16.dp))
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Safe Status",
                            tint = EmeraldGreen,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "Safe – No Active Alert",
                            color = EmeraldGreen,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Date & Time Badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(CardNavyContainer)
                        .border(1.dp, TextMutedBlue.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
                        .padding(horizontal = 8.dp, vertical = 5.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.DateRange,
                            contentDescription = "Calendar",
                            tint = ElectricCyan,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "Wed, Jan 15, 2025  10:24 AM",
                            color = TextWhite,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Right: Notifications & Profile
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Notification Bell with badge
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(CardNavyContainer)
                        .border(1.dp, GoldenYellow, CircleShape)
                        .clickable { onNotificationsClick() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Notifications,
                        contentDescription = "Notifications",
                        tint = GoldenYellow,
                        modifier = Modifier.size(18.dp)
                    )
                    // Badge 3
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .size(14.dp)
                            .clip(CircleShape)
                            .background(EmergencyRed),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "3",
                            color = TextWhite,
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Student Profile Pill
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(CardNavyContainer)
                        .border(1.dp, VioletPurple, RoundedCornerShape(16.dp))
                        .clickable { onProfileClick() }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(VioletPurple),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Face,
                                contentDescription = "Student Avatar",
                                tint = TextWhite,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Column {
                            Text(
                                text = "Student",
                                color = TextWhite,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = studentProfile.gradeSection,
                                color = TextMutedBlue,
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Normal
                            )
                        }
                    }
                }
            }
        }
    }
}
