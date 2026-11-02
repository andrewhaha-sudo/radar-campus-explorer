package com.radar.campusexplorer.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radar.campusexplorer.ui.theme.*

enum class ButtonStyle {
    GOLD,
    CYAN,
    RED,
    PURPLE,
    BLUE,
    GREEN,
    NAVY
}

@Composable
fun RadarGameButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    badgeCount: Int = 0,
    style: ButtonStyle = ButtonStyle.BLUE,
    isSelected: Boolean = false,
    height: Dp = 44.dp
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(if (isPressed) 0.95f else 1f, label = "buttonScale")

    val (topColor, bottomColor, borderColor, textColor) = when {
        isSelected || style == ButtonStyle.GOLD -> Quadruple(
            GoldenYellow, GoldDark, GoldBorder, TextDarkNavy
        )
        style == ButtonStyle.CYAN -> Quadruple(
            ElectricCyan, CyanGlow, CyanBorder, TextDarkNavy
        )
        style == ButtonStyle.RED -> Quadruple(
            EmergencyRed, RedGlow, Color(0xFFFF9EAA), TextWhite
        )
        style == ButtonStyle.PURPLE -> Quadruple(
            VioletPurple, PurpleDark, Color(0xFFD4B0FF), TextWhite
        )
        style == ButtonStyle.GREEN -> Quadruple(
            EmeraldGreen, GreenGlow, Color(0xFF7EFFBA), TextDarkNavy
        )
        style == ButtonStyle.NAVY -> Quadruple(
            CardGlossBlue, CardNavyContainer, PanelBorderCyan, TextWhite
        )
        else -> Quadruple( // BLUE
            DeepRoyalBlue, CardNavyContainer, ElectricCyan.copy(alpha = 0.6f), TextWhite
        )
    }

    Box(
        modifier = modifier
            .height(height)
            .scale(scale)
            .clip(RoundedCornerShape(12.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(topColor, bottomColor)
                )
            )
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) GoldenYellow else borderColor,
                shape = RoundedCornerShape(12.dp)
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
            .padding(horizontal = 12.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = text,
                    tint = textColor,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = text,
                color = textColor,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
            if (badgeCount > 0) {
                Spacer(modifier = Modifier.width(6.dp))
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(EmergencyRed),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = badgeCount.toString(),
                        color = TextWhite,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }
        }
    }
}

private data class Quadruple<A, B, C, D>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D
)
