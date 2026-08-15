import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleProp, Text, TextStyle } from "react-native";
import { ImageStyle } from "expo-image";

// Renders a company logo, falling back to the company initial if the image
// is missing or fails to load (e.g. blocked networks / sandbox).
export function CompanyLogo({
  uri,
  name,
  logoStyle,
  textStyle,
}: {
  uri?: string;
  name?: string;
  logoStyle: StyleProp<ImageStyle>;
  textStyle: StyleProp<TextStyle>;
}) {
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={logoStyle}
        contentFit="contain"
        transition={200}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Text style={textStyle}>{(name || "?").charAt(0).toUpperCase()}</Text>;
}
