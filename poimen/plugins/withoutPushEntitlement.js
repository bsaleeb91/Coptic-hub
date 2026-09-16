// plugins/withoutPushEntitlement.js
// Strips the `aps-environment` entitlement that expo-notifications adds.
//
// WHY: the app schedules LOCAL notifications only (lib/reminders/*) — there is
// no push token, no device registration, no notification server. Local
// notifications require no entitlement. But expo-notifications' iOS plugin adds
// `aps-environment` unconditionally, because the same package also does remote
// push, and that entitlement is what makes Xcode demand a provisioning profile
// with the Push Notifications capability. Build 18 failed exactly there:
//
//   Provisioning profile "...AppStore..." doesn't support the Push
//   Notifications capability.
//
// There were two ways out. Turn on Push Notifications for the bundle id and
// regenerate the profile — which would have the app claim a capability it never
// uses, and invite an App Store review question we would have to answer with
// "we don't actually do that". Or drop the entitlement. This is the second.
//
// Keeping the plugin itself (rather than removing it from app.json) is what
// preserves the Android notification colour; only the iOS entitlement goes.
//
// ORDER MATTERS, and not the way you would guess: this must be listed BEFORE
// "expo-notifications" in the plugins array. Expo composes mods by wrapping —
// each withEntitlementsPlist call wraps the one registered before it — so the
// LAST plugin listed runs FIRST. Listed after expo-notifications, this runs
// against an empty entitlements object and silently does nothing, which is
// exactly what it did on the first attempt. Verify with:
//
//   npx expo config --type introspect | grep aps-environment
//
// It should print nothing.
//
// If remote push is ever added, delete this plugin and enable the capability
// properly — do not work around it here.

const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
