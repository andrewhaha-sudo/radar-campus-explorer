package com.radar.campusexplorer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.domain.model.AvatarType
import com.radar.campusexplorer.domain.model.StudentProfile
import com.radar.campusexplorer.ui.components.ButtonStyle
import com.radar.campusexplorer.ui.components.RadarGameButton
import com.radar.campusexplorer.ui.theme.*

@Composable
fun StudentProfileScreen(
    profile: StudentProfile,
    onBackClick: () -> Unit,
    onSaveProfile: (StudentProfile) -> Unit,
    modifier: Modifier = Modifier
) {
    var nameInput by remember { mutableStateOf(profile.name) }
    var gradeSectionInput by remember { mutableStateOf(profile.gradeSection) }
    var selectedAvatar by remember { mutableStateOf(profile.avatarType) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkNavyBg)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Header
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

            Text(
                text = "Student Profile & Trainer Card",
                color = VioletPurple,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black
            )

            Box(modifier = Modifier.size(40.dp))
        }

        // Trainer Card Box
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            VioletPurple.copy(alpha = 0.3f),
                            CardNavyContainer
                        )
                    )
                )
                .border(2.dp, VioletPurple, RoundedCornerShape(20.dp))
                .padding(16.dp)
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Avatar Circle
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(VioletPurple)
                            .border(2.dp, GoldenYellow, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (selectedAvatar == AvatarType.BOY) Icons.Default.Face else Icons.Default.Face4,
                            contentDescription = "Avatar",
                            tint = TextWhite,
                            modifier = Modifier.size(40.dp)
                        )
                    }

                    Column {
                        Text(nameInput, color = TextWhite, fontSize = 18.sp, fontWeight = FontWeight.Black)
                        Text(gradeSectionInput, color = GoldenYellow, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("ID: ${profile.id}", color = TextMutedBlue, fontSize = 10.sp)
                    }
                }

                // Avatar Switcher Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    RadarGameButton(
                        text = "Boy Character",
                        icon = Icons.Default.Face,
                        isSelected = selectedAvatar == AvatarType.BOY,
                        onClick = { selectedAvatar = AvatarType.BOY },
                        style = ButtonStyle.PURPLE,
                        modifier = Modifier.weight(1f)
                    )

                    RadarGameButton(
                        text = "Girl Character",
                        icon = Icons.Default.Face4,
                        isSelected = selectedAvatar == AvatarType.GIRL,
                        onClick = { selectedAvatar = AvatarType.GIRL },
                        style = ButtonStyle.PURPLE,
                        modifier = Modifier.weight(1f)
                    )
                }

                // Edit Fields
                OutlinedTextField(
                    value = nameInput,
                    onValueChange = { nameInput = it },
                    label = { Text("Student Name", color = TextMutedBlue) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextWhite,
                        unfocusedTextColor = TextWhite,
                        focusedBorderColor = ElectricCyan,
                        unfocusedBorderColor = TextMutedBlue
                    )
                )

                OutlinedTextField(
                    value = gradeSectionInput,
                    onValueChange = { gradeSectionInput = it },
                    label = { Text("Grade & Section", color = TextMutedBlue) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextWhite,
                        unfocusedTextColor = TextWhite,
                        focusedBorderColor = ElectricCyan,
                        unfocusedBorderColor = TextMutedBlue
                    )
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        RadarGameButton(
            text = "SAVE PROFILE CHANGES",
            icon = Icons.Default.Save,
            style = ButtonStyle.GOLD,
            height = 50.dp,
            onClick = {
                val updated = profile.copy(
                    name = nameInput,
                    gradeSection = gradeSectionInput,
                    avatarType = selectedAvatar
                )
                onSaveProfile(updated)
                onBackClick()
            },
            modifier = Modifier.fillMaxWidth()
        )
    }
}
