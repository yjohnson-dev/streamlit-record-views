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

