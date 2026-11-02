package com.radar.campusexplorer.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = ElectricCyan,
    onPrimary = TextDarkNavy,
    primaryContainer = CardNavyContainer,
    onPrimaryContainer = TextWhite,
    secondary = GoldenYellow,
    onSecondary = TextDarkNavy,
    tertiary = VioletPurple,
    background = DarkNavyBg,
    onBackground = TextWhite,
    surface = CardNavyContainer,
    onSurface = TextWhite,
    error = EmergencyRed,
    onError = TextWhite
)

@Composable
fun RadarTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = RadarTypography,
        shapes = RadarShapes,
        content = content
    )
}
