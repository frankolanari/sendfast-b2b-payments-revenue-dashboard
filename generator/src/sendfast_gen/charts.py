"""Gate 3 profile charts: does the synthetic data look real? (PLAN.md Section 4A, G3 sign-off)

Static PNG evidence for the owner. Palette: the dataviz reference instance (light mode),
categorical slots in fixed order; titles state the insight; grid and axes stay recessive.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

from .raw import RawTable  # noqa: E402
from .stories import _ledger_usd  # noqa: E402
from .world import World, opt  # noqa: E402

SURFACE, INK, INK_2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]  # slots 1-4


def _style(ax, title: str, subtitle: str, xlabel: str = "", ylabel: str = "") -> None:
    ax.set_facecolor(SURFACE)
    ax.set_title(title, loc="left", fontsize=12.5, fontweight="bold", color=INK, pad=22)
    ax.text(0, 1.02, subtitle, transform=ax.transAxes, fontsize=9.5, color=INK_2, va="bottom")
    ax.set_xlabel(xlabel, color=INK_2, fontsize=9.5)
    ax.set_ylabel(ylabel, color=INK_2, fontsize=9.5)
    ax.tick_params(colors=INK_2, labelsize=8.5, length=0)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)


def _fig(width: float = 9.0, height: float = 4.6):
    fig, ax = plt.subplots(figsize=(width, height), dpi=150)
    fig.patch.set_facecolor(SURFACE)
    return fig, ax


def _money(v: float) -> str:
    return f"${v / 1e6:.0f}M" if v >= 1e6 else f"${v / 1e3:.0f}k"


def _save(fig, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, facecolor=SURFACE, bbox_inches="tight", metadata={"Software": None})
    plt.close(fig)
    return path


def deal_sizes(f, out: Path) -> Path:
    amt = f["crm_hubspot.deals"]["amount"].dropna().astype(float)
    fig, ax = _fig()
    bins = np.logspace(np.log10(max(1000.0, amt.min())), np.log10(amt.max()), 40)
    ax.hist(amt, bins=bins, color=SERIES[0], edgecolor=SURFACE, linewidth=1.5)
    ax.set_xscale("log")
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: _money(v)))
    med = float(amt.median())
    ax.axvline(med, color=INK_2, linewidth=1, linestyle=(0, (3, 3)))
    ax.text(
        med, ax.get_ylim()[1] * 0.95, f"  median {_money(med)}", color=INK_2, fontsize=8.5, va="top"
    )
    _style(
        ax,
        "Deal sizes are log-normal with a long enterprise tail",
        f"{len(amt):,} HubSpot deals with an amount (raw crm_hubspot.deals)",
        "Deal amount (USD, log scale)",
        "Deals",
    )
    return _save(fig, out / "1_deal_sizes.png")


def volume_curve(tx: pd.DataFrame, out: Path) -> Path:
    monthly = tx[tx["status"] == "succeeded"].groupby("month")["usd"].sum() / 1e6
    fig, ax = _fig()
    x = np.arange(len(monthly))
    colors = [SERIES[1] if m.endswith("-12") else SERIES[0] for m in monthly.index]
    ax.bar(x, monthly.values, color=colors, width=0.8, edgecolor=SURFACE, linewidth=1)
    ax.set_xticks(x[::3], list(monthly.index)[::3])
    for i, m in enumerate(monthly.index):
        if m.endswith("-12"):
            ax.text(i, monthly.iloc[i], "Dec", ha="center", va="bottom", fontsize=8, color=INK_2)
    _style(
        ax,
        "Payment volume grows steadily, with a December peak each year",
        "Succeeded transaction volume per month, USD millions (raw ledger.transactions + "
        "rates.fx_rates)",
        "",
        "USD millions",
    )
    return _save(fig, out / "2_volume_curve.png")


def churn_timing(w: World, out: Path) -> Path:
    rows = []
    for _, r in w.customers[w.customers["kind"] == "customer"].iterrows():
        live = opt(r["live_date"])
        for kind, d in (("contract", opt(r["contract_end"])), ("silent", opt(r["silent_stop"]))):
            if live and d:
                rows.append({"kind": kind, "months": (d - live).days / 30.44})
    df = pd.DataFrame(rows)
    fig, ax = _fig()
    data = [df.loc[df["kind"] == k, "months"] for k in ("contract", "silent")]
    ax.hist(
        data,
        bins=np.arange(0, 25, 1),
        stacked=True,
        color=SERIES[:2],
        edgecolor=SURFACE,
        linewidth=1.5,
        label=["Contract churn (subscription ended)", "Silent churn (stopped transacting)"],
    )
    ax.legend(frameon=False, fontsize=8.5, labelcolor=INK_2, loc="upper right")
    early = float((df["months"] < 3).mean())
    _style(
        ax,
        f"Churn is front-loaded: {early:.0%} of churn happens in the first 3 months",
        f"{len(df)} churned accounts, months from go-live to churn (generator truth, test "
        f"accounts excluded)",
        "Months after go-live",
        "Accounts",
    )
    return _save(fig, out / "3_churn_timing.png")


def failures_by_corridor(tx: pd.DataFrame, cfg, out: Path) -> Path:
    sp = cfg["stories"]["corridor_spike"]
    t = tx.assign(lane=tx["corridor"] + " · " + tx["rail"], failed=tx["status"] == "failed")
    rate = t.groupby("lane")["failed"].mean().sort_values()
    fig, (ax1, ax2) = plt.subplots(
        1, 2, figsize=(11, 4.8), dpi=150, gridspec_kw={"width_ratios": [1, 1.3]}
    )
    fig.patch.set_facecolor(SURFACE)
    ax1.barh(rate.index, rate.values * 100, color=SERIES[0], height=0.7, edgecolor=SURFACE)
    for i, v in enumerate(rate.values):
        ax1.text(v * 100, i, f" {v:.1%}", va="center", fontsize=7.5, color=INK_2)
    _style(
        ax1,
        "SWIFT fails most; domestic rails least",
        "Failure rate by corridor · rail, all months",
        "Failure rate (%)",
    )
    ax1.grid(axis="x", color=GRID, linewidth=0.8)
    ax1.grid(axis="y", visible=False)

    target = f"{sp['corridor']} · {sp['rail']}"
    spike = t[t["lane"] == target].groupby("month")["failed"].mean() * 100
    rest = t[t["lane"] != target].groupby("month")["failed"].mean() * 100
    x = np.arange(len(spike))
    ax2.plot(x, spike.values, color=SERIES[1], linewidth=2, marker="o", markersize=4, label=target)
    ax2.plot(
        x, rest.reindex(spike.index).values, color=SERIES[0], linewidth=2, label="All other lanes"
    )
    i = list(spike.index).index(sp["month"])
    ax2.annotate(
        f"{spike.iloc[i]:.0f}% in {sp['month']}",
        (i, spike.iloc[i]),
        xytext=(10, -4),
        textcoords="offset points",
        fontsize=8.5,
        color=INK,
    )
    ax2.set_xticks(x[::3], list(spike.index)[::3])
    ax2.legend(frameon=False, fontsize=8.5, labelcolor=INK_2, loc="upper left")
    _style(ax2, f"One lane spiked: {target}", "Monthly failure rate (%)")
    fig.tight_layout()
    return _save(fig, out / "4_failures_by_corridor.png")


def revenue_trend(w: World, out: Path) -> Path:
    real = set(w.accounts.loc[w.accounts["kind"] == "customer", "account_id"])
    rev = w.revenue_monthly[w.revenue_monthly["account_id"].isin(real)]
    parts = ["platform_fee", "usage_fee", "fx_margin", "true_up"]
    labels = ["Platform fee", "Usage fee", "FX margin", "Min-commit true-up"]
    by = rev.groupby("month")[parts].sum() / 1e6
    by = by[by.index < date(w.as_of.year, w.as_of.month, 1)]  # the as-of month isn't closed yet
    fig, ax = _fig()
    x = np.arange(len(by))
    bottom = np.zeros(len(by))
    for col, label, color in zip(parts, labels, SERIES, strict=True):
        ax.bar(
            x,
            by[col].values,
            bottom=bottom,
            color=color,
            width=0.8,
            edgecolor=SURFACE,
            linewidth=1,
            label=label,
        )
        bottom += by[col].values
    ax.set_xticks(x[::3], [f"{m:%Y-%m}" for m in by.index][::3])
    ax.legend(frameon=False, fontsize=8.5, labelcolor=INK_2, loc="upper left", ncols=2)
    _style(
        ax,
        "Usage and FX margin drive revenue; platform fees are the stable base",
        "Net revenue per month by component, USD millions (generator truth, test accounts "
        "excluded)",
        "",
        "USD millions",
    )
    return _save(fig, out / "5_revenue_trend.png")


def render(tables: list[RawTable], w: World, out: Path) -> list[Path]:
    f = {t.qualified: t.frame for t in tables}
    tx = _ledger_usd(f)
    return [
        deal_sizes(f, out),
        volume_curve(tx, out),
        churn_timing(w, out),
        failures_by_corridor(tx, w.cfg, out),
        revenue_trend(w, out),
    ]
