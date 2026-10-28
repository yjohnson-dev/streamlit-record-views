# Adding a component

There are two paths: a new card, which reuses the shared card frontend and Python
wrapper, and a new component family, which needs its own renderer. Both share one
Vite build and the same pyproject declarations.

## Adding a card variant

A card variant is a config class plus a frontend layout. One component,
`card`, draws every variant: the `card` function sends the variant of the config
class in the payload, and the renderer draws it with that variant's layout. The
card-focused lineage components use the same layouts. The shared code already
provides width fitting, status rendering, the help tooltip, hover, the
accessibility label, click and keyboard activation, and cleanup.

### 1. Frontend

Create `record_views/frontend/src/cards/<variant>_card/layout.ts` and
`style.css`. The layout is a function over `ViewData`. It handles every size,
and calls a compact layout from `shared/compact.ts` for `"compact"`.

```typescript
// layout.ts
import { span, typeIcon } from "../../shared/dom";
import type { ViewData } from "../../shared/types";
import { smallCaption, smallEnd, smallLead } from "../../shared/view";

export function renderBadgeCard(d: ViewData): (HTMLElement | null)[] {
  return [
    typeIcon(d),
    smallLead(d),
    smallCaption(d),
    smallEnd(d, d.headline ? span("", String(d.headline[1])) : null),
  ];
}
```

Scope the class names in `style.css` to the variant, such as
`.card-badge .card-grid`, so they do not collide with other variants:

```css
.card-badge {
  padding: 0.375rem 0.75rem;
}
```

Then add the variant to the shared files:

- `LAYOUTS` in `shared/variants.ts`: the layout from `layout.ts`.
- `CardVariant` in `shared/types.ts`.
- `COMPACT` in `shared/compact.ts`: the compact layout of the variant, with a
  function such as `compactBadge`.
- An `@import` of its `style.css` in `shared/cards.css`, which the card
  component and the lineage components both load.

The shared classes that `view.ts` acts on:

| Class | Effect |
|---|---|
| `card-lead` | The element that fades first. A small card gives up its parts in order as its row is clipped: the status text, then the caption, then the headline (`smallLead`, `smallCaption` and `smallEnd` build the row). The header of a larger card reduces its status to a dot once the lead is below half its row. |
| `card-end` | The right-hand item, which never shrinks. |
| `card-caption` | The caption, which the caller writes; it is free text, so it fades rather than shortening. |
| `card-key` | The bold label of a subtitle or caption. A title writes its label and value as one text, with `titleText`. |
| `card-fade` | Single-line text that fades out when it overflows. |
| `card-clamp` | Multi-line text cut to `--card-lines` lines, and `--card-lines-expanded` in the hover expansion. |
| `card-shrink` | Text whose font size steps down to fit, for headline figures. |
| `card-table` | A key/value grid that stacks once a cell would wrap. |

The variant needs no Vite entry and no manifest declaration of its own.

### 2. Config class

Add the class to `record_views/card_config.py`. It is a frozen dataclass that
extends the private base class, which holds the shared options and checks them
in `__post_init__`. Add the options of the variant as fields, and check them in
its own `__post_init__` with the helpers in `cards/checks.py`
(`check_choice` for any option with a fixed set of values). Set `variant`, and
`field_limits` when the variant shows a different number of fields per size (see
`cards/payload.py`). Write an `Attributes:` section that describes every field,
including the shared ones.

```python
@dataclass(frozen=True, kw_only=True)
class BadgeCard(_CardConfig):
    """Describes a single-line badge for a record.

    Attributes:
        border: Whether to outline the card with a border.
        tone: How strong the badge looks, "soft" or "solid".
    """

    variant: ClassVar[str] = "badge"

    tone: Literal["soft", "solid"] = "soft"

    def __post_init__(self) -> None:
        super().__post_init__()
        check_choice("tone", self.tone, ("soft", "solid"))
```

Then wire the class in `cards/view.py`: add it to `CardConfig` and `_BY_NAME`
(so `card_config="badge"` works), and send its options in `view_payload`.

```python
    elif isinstance(config, BadgeCard):
        payload.update(tone=config.tone)
```

Export the class from `card_config.py`. The `card` function, its key
(`"card-badge:<id>"`), and its click handling need no change.

### 3. Tests and build

Add pytest cases using the fake component in `tests/test_cards.py` (config validation, and the payload), and Vitest
cases next to any pure frontend logic (`*.test.ts`). Then refresh the
build (see below) and confirm it with `scripts/check-build.sh`.

`scripts/check-build.sh` only verifies the build. To refresh it, build the
`frontend-builder` image and copy `/app/frontend/build` out of it into
`record_views/frontend/build`:

```bash
podman build --target frontend-builder -t streamlit-record-views:frontend-builder .
container=$(podman create streamlit-record-views:frontend-builder)
rm -rf record_views/frontend/build
podman cp "$container:/app/frontend/build/." record_views/frontend/build
podman rm "$container"
```

## Adding a lineage layout

A lineage layout is a view over a `LineageGraph`, defined in
`lineage/model.py`. (`lineage/graph.py` is the `lineage_graph` component, not
the model.) Python resolves the topology
(edges, layers, sequences); the frontend only arranges nodes.
`shared/lineage.ts` already provides selection, hover highlighting of linked
records (a payload with `highlightLinks` also gets the chain mode and a static
selection highlight; see `shared/chain.ts`), the hover card (the configured variant at the `on_hover` size), connectors, resizing, fades,
and cleanup.

### 1. Python wrapper

Create `record_views/lineage/<name>.py`. Build the graph, add the fields your
layout needs to `graph_payload`, and mount through `render_lineage`, which
validates `height`, `width`, `on_select`, and `status_display` (with `check_choice` from `cards/checks.py`), applies a `selected` value that the script changed, passes the selected id to an `on_select` callback, and returns the selection:

```python
def lineage_chain(
    records: Record | Iterable[Record],
    links: Iterable[Link | tuple[Any, ...]] = (),
    *,
    focus: str,
    key: str | None = None,
    selected: str | None = None,
    on_select: OnSelect = "rerun",
    args: tuple[Any, ...] | None = None,
    kwargs: dict[str, Any] | None = None,
    height: Height = "content",
    width: Width = "stretch",
    border: bool = False,
    background: bool = False,
    status_display: StatusDisplay = "full",
    card_config: CardSpec = None,
    on_hover: OnHover = "medium",
) -> str | None:
    """Renders the records upstream of a record as a chain."""
    graph = build_graph(records, links)
    graph.require(focus)
    chain = graph.path_to(focus)
    data = {
        **graph_payload(
            graph,
            chain,
            card_config=card_config,
            on_hover=on_hover,
            status_display=status_display,
        ),
        "chain": chain,
        "focus": focus,
    }
    return render_lineage(
        "lineage_chain",
        data,
        key=key,
        selected=selected,
        on_select=on_select,
        args=args,
        kwargs=kwargs,
        height=height,
        width=width,
        border=border,
        background=background,
        status_display=status_display,
    )
```

`links` is the second parameter, after `records`. `build_graph` turns `Link`
objects and tuples into the edges of the graph. It raises `ValueError` for a
link that names an id that no record has, so the `Raises` section of the
docstring must say that. A component that does not use links, such as
`lineage_sankey`, has no `links` parameter.

Keep the shared parameters, in this order and with these defaults, so every
lineage component reads the same. Export the function from
`record_views/lineage/__init__.py` and `record_views/__init__.py`.

A layout that draws records as cards takes `card_config` and `on_hover`, and
passes them to `graph_payload`. The payload then holds, for each node, the
compact card of the config and the `hover` card of the `on_hover` size. A layout
that draws no cards, such as `lineage_steps`, takes neither.

`border` and `background` frame the whole view, through the class `lin-framed`
that the shared renderer adds to every view. The `border` and `background` of
the `card_config` style each node, through the `--lin-node-line` and
`--lin-node-fill` variables, which `nodeElement` sets.

### 2. Frontend

Create `record_views/frontend/src/lineage/<name>/index.ts` and `style.css`, and
register the entry in `vite.config.ts` as `lineage_<name>`:

```typescript
import { el } from "../../shared/dom";
import { type LineageData, lineageRenderer } from "../../shared/lineage";
import "./style.css";

interface ChainData extends LineageData {
  chain: string[];
  focus: string;
}

export default lineageRenderer<ChainData>("Lineage chain", (ctx) => {
  const chain = el(
    "div",
    "lin-chain",
    ...ctx.data.chain.map((id) =>
      ctx.node(ctx.get(id)!, { card: "tile", emphasis: id === ctx.data.focus })
    )
  );
  ctx.connect(chain);
  return chain;
});
```

```css
@import "../../shared/lineage.css";

.lin-chain {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}
```

The context passed to the layout:

| Member | Use |
|---|---|
| `data`, `get(id)` | The payload, and the node for an id. |
| `node(node, options)` | A selectable record drawn as a compact card: `card` is the variant the layout uses when the user gives no `card_config` (`"record"`, `"tile"`, `"property"`, or `"ledger"`), `meta`, `emphasis`. With a `card_config`, its variant replaces `card`. |
| `bind(element, node)` | Makes any element selectable as a node, such as an embedded card. |
| `connect(container, options)` | Draws connectors between nodes in the container and redraws them on resize. `vertical` makes them leave from the bottom and top. |
| `onResize(callback)` | Runs on mount and on every width change, before connectors redraw. |
| `cleanup(fn)`, `key` | Disposal on rerender, and the component key for state that outlives a rerender. |

`.lineage-root` is an inline-size container, so responsive layouts can use
`@container` queries. Keep pure layout math in a separate module with Vitest
tests next to it.

### 3. Declarations, tests, and build

Declare `lineage_<name>` in both manifests; `tests/test_packaging.py` fails if
they differ.

- `pyproject.toml`, for running from a source checkout:

  ```toml
  [[tool.streamlit.component.components]]
  name = "lineage_<name>"
  asset_dir = "record_views/frontend/build"
  ```

- `record_views/pyproject.toml`, which ships inside installed packages:

  ```toml
  [[tool.streamlit.component.components]]
  name = "lineage_<name>"
  asset_dir = "frontend/build"
  ```

Test the payload with the fake component in `tests/test_lineage_core.py`, and
refresh the committed build as described in the card steps above, then run
`scripts/check-build.sh`.

## Adding a component family

Components that are neither cards nor lineage layouts follow the same
declaration and build steps, with their own renderer and wrapper:

- Register through an equivalent of `card_component` or `lineage_component`, a
  cached function, so nothing is registered at import time.
- Return a cleanup function from the renderer that removes every listener,
  observer, and timer it created.
- Reuse `shared/dom.ts` for element helpers and colors, and the `--st-*` theme
  variables for styling.
- Accept Streamlit's `width` convention with `check_width`, and drop
  inline-size containment on the root for `width="content"`.
