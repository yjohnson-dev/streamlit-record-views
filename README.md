# streamlit-record-views

Record cards and lineage components for Streamlit.

## Install

```bash
pip install streamlit-record-views
```

The repository does not contain the compiled frontend, so `pip install` from a git
checkout does not work.

## Use

```python
import streamlit as st
from datetime import date
from record_views import (CardView, Link, Record, RecordField, card, card_config,
                          lineage_flow)

order = Record("Sales Order", RecordField("Sales Order", "SO-0001"),
               id="SO-0001", status="Open",
               subtitle=RecordField("Customer", "Acme"),
               caption=RecordField("Order Date", "2026-10-02"),
               timestamp=date(2026, 10, 2),
               fields={"Amount": 4200})
invoice = Record("Invoice", "INV-0001", id="INV-0001", status="Paid",
                 fields={"Amount": 4200})

summary = CardView(order, card_config.RecordCard(headline="Amount"), size="small",
                   on_hover=CardView(order, card_config.PropertyCard(), size="large"))
card(summary)
lineage_flow([order, invoice], [Link(order, invoice, "billed as")])
```

The title, subtitle, and caption each take text or a `RecordField`. A labeled title
reads "Sales Order SO-0001", and a labeled subtitle or caption reads "Customer: Acme"
with the label in bold. Cards draw only the text you give them: the `timestamp` places
a record in time order for the lineage components, and the caption shows a date.
The `headline` option of every card configuration picks the field a card leads with.

A `CardView` defines a card: the record, its configuration, its size, and what hovering
it shows. `card()` renders it. The hover can show the same card at another size, or
another `CardView` with its own record, configuration, and size.

Every function and class has a docstring.
