import json
import math

# Gang member data
gang_data = [
    {"name":"Thug 1","task":"Human Trafficking","hack":1336,"str":4825,"def":4145,"dex":4511,"agi":2495,"cha":1439,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":2.0127744000000005,"cha_mult":1.2579840000000004,"moneyGain":498419.44561996503},
    {"name":"Thug 2","task":"Human Trafficking","hack":1072,"str":4168,"def":3639,"dex":4095,"agi":2970,"cha":1079,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":2.0127744000000005,"cha_mult":1.2579840000000004,"moneyGain":441585.3901197883},
    {"name":"Thug 3","task":"Human Trafficking","hack":1148,"str":5078,"def":4471,"dex":4478,"agi":3072,"cha":1087,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":2.0127744000000005,"cha_mult":1.2579840000000004,"moneyGain":476723.2834350982},
    {"name":"Thug 5","task":"Human Trafficking","hack":1136,"str":3737,"def":3354,"dex":4142,"agi":2761,"cha":1110,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":2.0127744000000005,"cha_mult":1.2579840000000004,"moneyGain":442649.50240129954},
    {"name":"Thug 6","task":"Human Trafficking","hack":883,"str":5259,"def":4814,"dex":4066,"agi":3474,"cha":824,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":2.012774400000001,"cha_mult":1.2579840000000004,"moneyGain":437101.03871163155},
    {"name":"Thug 7","task":"Human Trafficking","hack":1112,"str":3159,"def":2894,"dex":4028,"agi":2311,"cha":1192,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":2.0127744000000005,"cha_mult":1.2579840000000004,"moneyGain":431861.5495240473},
    {"name":"Thug 8","task":"Human Trafficking","hack":1114,"str":3767,"def":3488,"dex":4055,"agi":2302,"cha":1159,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":2.0127744000000005,"cha_mult":1.2579840000000004,"moneyGain":441115.6739495587},
    {"name":"Thug 9","task":"Human Trafficking","hack":931,"str":3841,"def":3642,"dex":4185,"agi":2970,"cha":915,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":2.0127744000000005,"cha_mult":1.2579840000000004,"moneyGain":428894.733993994},
    {"name":"Thug 10","task":"Human Trafficking","hack":961,"str":3998,"def":3825,"dex":4233,"agi":2410,"cha":710,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":1.7971200000000005,"cha_mult":1.1232000000000002,"moneyGain":425557.2951402385},
    {"name":"Thug 11","task":"Human Trafficking","hack":819,"str":3074,"def":2958,"dex":3827,"agi":2266,"cha":622,"hack_mult":1.05,"str_mult":1.7521920000000002,"def_mult":1.5138938880000004,"dex_mult":1.4040000000000001,"agi_mult":1.7971200000000005,"cha_mult":1.1232000000000002,"moneyGain":380390.9339791172},
    {"name":"Thug 4 Understudy","task":"Human Trafficking","hack":433,"str":2532,"def":2477,"dex":2902,"agi":1980,"cha":273,"hack_mult":1,"str_mult":1.6224,"def_mult":1.4017536000000002,"dex_mult":1.3,"agi_mult":1.6640000000000001,"cha_mult":1.04,"moneyGain":286464.11882543424}
]

# Human Trafficking task parameters
task = {
    "baseMoney": 360,
    "hackWeight": 30,
    "strWeight": 5,
    "defWeight": 5,
    "dexWeight": 30,
    "agiWeight": 30,
    "chaWeight": 30,
    "difficulty": 36,
    "territory_money": 1.5
}

# Gang parameters
current_territory = 0.76
respect = 20000000
wanted = 50

def calculate_money_gain(member, territory=current_territory):
    """Calculate money gain using reported values scaled by territory"""
    base_money = member["moneyGain"]

    # Territory scaling
    current_territory_mult = max(0.005, (current_territory * 100) ** task["territory_money"] / 100)
    new_territory_mult = max(0.005, (territory * 100) ** task["territory_money"] / 100)

    territory_penalty = (0.2 * territory + 0.8)
    current_penalty = (0.2 * current_territory + 0.8)

    # Scale the money gain
    scaled_money = base_money * (new_territory_mult / current_territory_mult) ** (territory_penalty / current_penalty)

    return scaled_money

def analyze_stat_improvements():
    """Analyze how stat improvements affect earnings"""
    print("=== STAT IMPROVEMENT ANALYSIS ===")

    # Use Thug 1 as example
    base_member = gang_data[0]
    base_money = base_member["moneyGain"]

    print(f"Base earnings for {base_member['name']}: {base_money:,.0f} per cycle")
    print(f"Current stats - Hack: {base_member['hack']}, Str: {base_member['str']}, "
          f"Def: {base_member['def']}, Dex: {base_member['dex']}, Agi: {base_member['agi']}, Cha: {base_member['cha']}")

    # Test different stat multipliers
    stat_multipliers = [1.1, 1.2, 1.5, 2.0]

    for mult in stat_multipliers:
        # Calculate new stat weight manually
        old_weight = (
            (task["hackWeight"] / 100) * base_member["hack"] +
            (task["strWeight"] / 100) * base_member["str"] +
            (task["defWeight"] / 100) * base_member["def"] +
            (task["dexWeight"] / 100) * base_member["dex"] +
            (task["agiWeight"] / 100) * base_member["agi"] +
            (task["chaWeight"] / 100) * base_member["cha"]
        ) - (3.2 * task["difficulty"])

        new_weight = (
            (task["hackWeight"] / 100) * base_member["hack"] * mult +
            (task["strWeight"] / 100) * base_member["str"] * mult +
            (task["defWeight"] / 100) * base_member["def"] * mult +
            (task["dexWeight"] / 100) * base_member["dex"] * mult +
            (task["agiWeight"] / 100) * base_member["agi"] * mult +
            (task["chaWeight"] / 100) * base_member["cha"] * mult
        ) - (3.2 * task["difficulty"])

        if old_weight > 0 and new_weight > 0:
            # Money scales with stat weight in the exponent
            money_multiplier = (new_weight / old_weight) ** ((0.2 * current_territory + 0.8))
            new_money = base_money * money_multiplier

            print(f"Stats x{mult}: {new_money:,.0f} per cycle ({money_multiplier:.2f}x multiplier)")

def analyze_available_augments():
    """Analyze the best augment purchases for each member"""

    # All available augmentations with their effects
    all_augments = {
        "BitWire": {"hack": 1.05, "cost": 5e9},
        "Neuralstimulator": {"hack": 1.15, "cost": 10e9},
        "DataJack": {"hack": 1.1, "cost": 7.5e9},
        "BrachiBlades": {"str": 1.4, "def": 1.4, "cost": 20e9},
        "Synthetic Heart": {"str": 1.5, "agi": 1.5, "cost": 25e9},
        "Synfibril Muscle": {"str": 1.3, "def": 1.3, "cost": 15e9},
        "Graphene Bone Lacings": {"str": 1.7, "def": 1.7, "cost": 50e9}
    }

    print("\n=== AUGMENT ANALYSIS ===")

    for member in gang_data[:3]:  # Top 3 earners
        print(f"\n--- {member['name']} (Current: {member['moneyGain']:,.0f} per cycle) ---")

        augment_results = []

        for aug_name, aug_data in all_augments.items():
            # Calculate stat weight improvement
            current_weight = (
                (task["hackWeight"] / 100) * member["hack"] +
                (task["strWeight"] / 100) * member["str"] +
                (task["defWeight"] / 100) * member["def"] +
                (task["dexWeight"] / 100) * member["dex"] +
                (task["agiWeight"] / 100) * member["agi"] +
                (task["chaWeight"] / 100) * member["cha"]
            ) - (3.2 * task["difficulty"])

            new_weight = current_weight
            weight_increase = 0

            if "hack" in aug_data:
                hack_increase = member["hack"] * (aug_data["hack"] - 1)
                weight_increase += (task["hackWeight"] / 100) * hack_increase
            if "str" in aug_data:
                str_increase = member["str"] * (aug_data["str"] - 1)
                weight_increase += (task["strWeight"] / 100) * str_increase
            if "def" in aug_data:
                def_increase = member["def"] * (aug_data["def"] - 1)
                weight_increase += (task["defWeight"] / 100) * def_increase
            if "dex" in aug_data:
                dex_increase = member["dex"] * (aug_data["dex"] - 1)
                weight_increase += (task["dexWeight"] / 100) * dex_increase
            if "agi" in aug_data:
                agi_increase = member["agi"] * (aug_data["agi"] - 1)
                weight_increase += (task["agiWeight"] / 100) * agi_increase
            if "cha" in aug_data:
                cha_increase = member["cha"] * (aug_data["cha"] - 1)
                weight_increase += (task["chaWeight"] / 100) * cha_increase

            new_weight = current_weight + weight_increase

            if current_weight > 0 and new_weight > 0:
                money_multiplier = (new_weight / current_weight) ** ((0.2 * current_territory + 0.8))
                new_money = member["moneyGain"] * money_multiplier
                money_increase = new_money - member["moneyGain"]

                # Calculate ROI in hours
                hourly_increase = money_increase * 5 * 3600  # 5 cycles per second * 3600 seconds
                roi_hours = aug_data["cost"] / hourly_increase if hourly_increase > 0 else float('inf')

                augment_results.append({
                    "name": aug_name,
                    "cost": aug_data["cost"],
                    "money_increase": money_increase,
                    "hourly_increase": hourly_increase,
                    "multiplier": money_multiplier,
                    "roi_hours": roi_hours,
                    "weight_increase": weight_increase
                })

        # Sort by ROI
        augment_results.sort(key=lambda x: x["roi_hours"])

        print("Best augment investments (by ROI):")
        for aug in augment_results[:5]:
            if aug["roi_hours"] < float('inf'):
                print(f"  {aug['name']}: +{aug['hourly_increase']:,.0f}/hr, "
                      f"{aug['multiplier']:.3f}x, ROI: {aug['roi_hours']:.1f} hours, "
                      f"Cost: ${aug['cost']:,.0f}")

# Run current analysis
print("=== CURRENT GANG PERFORMANCE ===")
total_current = sum(member["moneyGain"] for member in gang_data)
print(f"Total current money per cycle: {total_current:,.0f}")
print(f"Total current money per second: {total_current * 5:,.0f}")
print(f"Total current money per hour: {total_current * 5 * 3600:,.0f}")

print("\n=== INDIVIDUAL PERFORMANCE ===")
for member in sorted(gang_data, key=lambda x: x["moneyGain"], reverse=True):
    print(f"{member['name']}: {member['moneyGain']:,.0f} per cycle ({member['moneyGain'] * 5 * 3600:,.0f}/hr)")

# Territory analysis
print("\n=== TERRITORY EXPANSION ANALYSIS ===")
total_at_100 = sum(calculate_money_gain(member, territory=1.0) for member in gang_data)
territory_improvement = total_at_100 - total_current
territory_multiplier = total_at_100 / total_current

print(f"Current (76% territory): {total_current * 5 * 3600:,.0f} per hour")
print(f"At 100% territory: {total_at_100 * 5 * 3600:,.0f} per hour")
print(f"Improvement: +{territory_improvement * 5 * 3600:,.0f} per hour")
print(f"Territory multiplier: {territory_multiplier:.2f}x")

# Progressive territory analysis
print("\n=== PROGRESSIVE TERRITORY IMPACT ===")
territory_levels = [0.76, 0.80, 0.85, 0.90, 0.95, 1.0]
for territory in territory_levels:
    total_money = sum(calculate_money_gain(member, territory=territory) for member in gang_data)
    multiplier = total_money / total_current
    print(f"{territory*100:3.0f}% territory: {total_money * 5 * 3600:,.0f}/hr ({multiplier:.2f}x)")

# Stat improvement analysis
analyze_stat_improvements()

# Augment analysis
analyze_available_augments()

# Summary recommendations
print("\n=== INVESTMENT RECOMMENDATIONS ===")
print("1. TERRITORY EXPANSION (Priority #1)")
print(f"   - Going from 76% to 100% territory gives {territory_multiplier:.2f}x money")
print(f"   - This is equivalent to +{territory_improvement * 5 * 3600:,.0f} per hour")
print(f"   - No direct cost, just requires territory warfare")

print("\n2. STAT AUGMENTATIONS (Priority #2)")
print("   - Focus on high-impact, cost-effective augments")
print("   - Synthetic Heart and BrachiBlades offer best ROI for combat members")
print("   - Neuralstimulator for hack-focused improvements")

print("\n3. MEMBER OPTIMIZATION")
print("   - Thug 4 Understudy has lowest earnings - consider better equipment first")
print("   - Focus augment investments on top 3-5 earners for maximum ROI")