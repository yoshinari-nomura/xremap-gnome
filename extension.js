// Copyright (C) 2022 Takashi Kokubun
// Licence: GPLv2+

import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class Xremap extends Extension {
  enable() {
    const dbus_object = `
      <node>
        <interface name="net.quickhack.Xremap">
          <method name="ActiveWindow">
            <arg type="s" direction="out" name="win"/>
          </method>
          <method name="WMClass">
            <arg type="s" direction="out" name="win"/>
          </method>
          <method name="WMClasses">
            <arg type="s" direction="out" name="win"/>
          </method>
          <method name="SetFocusByWMClass">
            <arg type="s" direction="in" name="wm_class"/>
            <arg type="s" direction="out" name="win"/>
          </method>
        </interface>
      </node>
    `;
    this.dbus = Gio.DBusExportedObject.wrapJSObject(dbus_object, this);
    this.dbus.export(Gio.DBus.session, '/net/quickhack/Xremap');
  }

  disable() {
    this.dbus.flush();
    this.dbus.unexport();
    delete this.dbus;
  }

  ActiveWindow() {
    const actor = global
      .get_window_actors()
      .find((a) => a.meta_window.has_focus() === true);
    if (actor) {
      const w = actor.get_meta_window();
      return JSON.stringify({
        wm_class: w.get_wm_class(),
        title: w.get_title(),
      });
    } else {
      return '{}';
    }
  }

  WMClass() {
    const actor = global
      .get_window_actors()
      .find((a) => a.meta_window.has_focus() === true);
    return actor && actor.get_meta_window().get_wm_class();
  }

  // To see the application names through the busctl
  WMClasses() {
    // Even if it makes the items in a list joined by "\n", dbus output escapes the new line characters.
    // So this outputs JSON array string instead of the plain text for understandability.
    return JSON.stringify([
      ...new Set(
        global
          .get_window_actors()
          .map((a) => a.get_meta_window().get_wm_class()),
      ),
    ]);
  }

  SetFocusByWMClass(wm_class) {
    const windows = global.get_window_actors().map(a=>a.meta_window);
    const targets = windows.filter(w=>(w.get_wm_class()||"").toLowerCase() === wm_class.toLowerCase() && !w.has_focus());
    const current = windows.find(w=>w.has_focus());
    let target = null;

    if (current && current.get_wm_class().toLowerCase() == wm_class.toLowerCase()) {
      // The current focused window seems to be located at the tail of
      // the window-actors list.
      //
      // Therefor, for cyclic changing focus within the windows that
      // have the same WM_CLASS (e.g. cyclic focus within the
      // Gnome-Terminal), we can simply find the target window by
      // performing first-match.
      target = targets.at(0)
    } else {
      // In another case, if we want to go back and forth between Emacs
      // and a termial, we may want to back to the previously-focused
      // terminal.  In this case, we have to perform the search from
      // the tail.
      target = targets.at(-1)
    }

    if (target) {
      target.activate(global.get_current_time());
      return wm_class;
    } else {
      return '';
    }
  }
}
