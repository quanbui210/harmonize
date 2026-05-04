import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Grid2x2, MessageSquare, ScanSearch } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/components/AuthProvider';
import { lightTheme } from '@/constants/mobile-theme';

const { colors } = lightTheme;

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(insets.bottom, 10);
  const tabBarHeight = 56 + tabBarBottomPadding;

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.page,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          height: tabBarHeight,
          paddingTop: 10,
          paddingBottom: tabBarBottomPadding,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        sceneStyle: {
          backgroundColor: colors.page,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Grid2x2 color={color} size={focused ? 22 : 20} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <ScanSearch color={color} size={focused ? 22 : 20} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Assist',
          tabBarIcon: ({ color, focused }) => (
            <MessageSquare color={color} size={focused ? 22 : 20} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
