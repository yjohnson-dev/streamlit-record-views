# streamlit-record-views

Record cards and lineage components for Streamlit.

## Install

```bash
pip install streamlit-record-views
```

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


A `LedgerCard` can itemize lines before its fields, such as the lines of an order.
Each `LedgerItem` takes a label and an amount, and optionally a quantity, a detail
line, a note, and an id. Clicking a line with an id calls `card()`'s `on_item` with
that id, apart from the card's own `on_click`.

```python
lines = [LedgerItem("HAL-9140", 2034.96, quantity=8, detail="Shackle, 1/2 in",
                    note="7 of 8 shipped", id="160735881")]
card(CardView(order, card_config.LedgerCard(headline="Amount", items=lines),
              size="large"),
     on_item=lambda item_id: st.write(f"Opened {item_id}"))
```
