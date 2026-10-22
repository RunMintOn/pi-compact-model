import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, fuzzyFilter, Input, SelectList, Text, type SelectItem } from "@earendil-works/pi-tui";

export async function select(
  ctx: ExtensionContext, title: string, items: SelectItem[], selected?: string,
): Promise<string | undefined> {
  return ctx.ui.custom<string | undefined>((tui, theme, keybindings, done) => {
    const container = new Container();
    const input = new Input({ placeholder: "输入以搜索…" });
    const listTheme = {
      selectedPrefix: (s: string) => theme.fg("accent", s),
      selectedText: (s: string) => theme.fg("accent", s),
      description: (s: string) => theme.fg("muted", s),
      scrollInfo: (s: string) => theme.fg("dim", s),
      noMatch: (s: string) => theme.fg("warning", s),
    };
    const makeList = (choices: SelectItem[]) => {
      const result = new SelectList(choices, 10, listTheme);
      result.onSelect = (item) => done(item.value);
      result.onCancel = () => done(undefined);
      return result;
    };
    let list = makeList(items);
    list.setSelectedIndex(Math.max(0, items.findIndex((item) => item.value === selected)));
    container.addChild(new Text(title, 1, 1));
    container.addChild(input);
    container.addChild(list);
    container.addChild(new Text("输入搜索 · ↑↓ 选择 · Enter 确认 · Esc 取消", 1, 1));
    return {
      get focused() { return input.focused; },
      set focused(value: boolean) { input.focused = value; },
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput(data: string) {
        if (keybindings.matches(data, "tui.select.up") || keybindings.matches(data, "tui.select.down") ||
          keybindings.matches(data, "tui.select.confirm") || keybindings.matches(data, "tui.select.cancel")) {
          list.handleInput(data);
        } else {
          input.handleInput(data);
          list = makeList(fuzzyFilter(items, input.getValue(), (item) => `${item.label} ${item.description ?? ""}`));
          container.children[2] = list;
        }
        tui.requestRender();
      },
    };
  });
}
