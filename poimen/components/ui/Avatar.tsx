// components/ui/Avatar.tsx
// Circular avatar: renders the photo when a URL is present, the initials
// otherwise. Screens pass their existing circle/text styles so each surface
// keeps its own colors and sizing; the image simply fills the same circle.
import React, { useState, useEffect } from 'react';
import { View, Text, Image, ViewStyle, TextStyle, StyleProp } from 'react-native';

interface AvatarProps {
  url?: string | null;
  initials: string;
  size: number;
  style?: StyleProp<ViewStyle>;    // the screen's circle style (bg, border…)
  textStyle?: StyleProp<TextStyle>;
}

export function Avatar({ url, initials, size, style, textStyle }: AvatarProps) {
  // A dead URL (deleted object, offline) falls back to initials instead of an
  // empty circle. Reset the failure flag whenever the URL changes.
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);

  return (
    <View style={[style, { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
      {url && !failed ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <Text style={textStyle}>{initials}</Text>
      )}
    </View>
  );
}
