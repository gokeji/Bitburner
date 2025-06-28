# Sleeve Karma Optimization Analysis

## Key Findings from Updated Model

### Experience and Level Mechanics

The model now correctly implements the game's experience-to-level conversion:

```javascript
level = floor(mult * (32 * ln(exp + 534.6) - 200));
```

**Experience Requirements:**

- Level 10: 173 exp
- Level 25: 597 exp
- Level 50: 1,937 exp
- Level 100: 11,255 exp

This logarithmic scaling means **early levels are cheap, but higher levels become exponentially expensive**.

### Critical Insight: Training vs Crime Tradeoff

**Simulation Results (Medium Sleeve: 40% shock, level 20 stats):**

#### 1 Hour of Homicide:

- **Karma Gained**: 234.3 (direct benefit)
- **Stat Growth**: 20 → 22 in all combat stats (+94 exp each)
- **Success Rate**: 6.5% → slightly higher due to stat gains
- **Shock**: 40% → 38.1% (natural decay)

#### 1 Hour of Strength Training:

- **Karma Gained**: 0 (opportunity cost: -234.3)
- **Stat Growth**: Strength 20 → 120 (+21,600 exp!)
- **Success Rate**: 6.5% → 20.2% (3x improvement!)
- **Future Karma Rate**: 234.3/hr → 728.7/hr (3.1x improvement!)

### The Break-Even Mathematics

**Training Investment Analysis:**

- **Cost**: 234.3 karma lost during 1 hour training
- **Benefit**: Karma rate improves by 494.4/hour (728.7 - 234.3)
- **Break-Even Time**: 234.3 ÷ 494.4 = **0.47 hours (28 minutes)**

This means after just 28 minutes of improved crime, the training pays for itself!

### Optimal Strategy Insights

#### 1. **Shock Penalty is Devastating at High Levels**

At 40% shock, training effectiveness is only 60%. This significantly impacts the exp/hour ratio.

#### 2. **Logarithmic Scaling Favors Early Training**

Going from level 20 to 120 requires 21,600 exp, but the marginal benefit is enormous due to crime success formula weights.

#### 3. **Crime Success Formula Sensitivity**

Homicide success depends heavily on strength (weight=2) and defense (weight=2). A modest stat increase has outsized impact on success rates.

#### 4. **Compound Returns**

Higher success rates → more karma AND more exp from crime → even higher success rates.

## Updated Optimization Algorithm

```
function optimizeKarmaGain(sleeve):
    if shock > 70%:
        return SHOCK_RECOVERY  // Always prioritize at high shock

    if shock > 30%:
        // Calculate break-even for shock recovery
        shock_benefit = estimateShockRecoveryBenefit(sleeve)
        if shock_benefit.breakEven < 2_hours:
            return SHOCK_RECOVERY

    // Calculate training break-even for each stat
    training_benefits = []
    for stat in [strength, defense, dexterity, agility]:
        benefit = calculateTrainingBenefit(sleeve, stat)
        if benefit.breakEven < 4_hours:
            training_benefits.push(benefit)

    if training_benefits.length > 0:
        best_training = training_benefits.maxBy(b => b.benefitPerHour)
        current_karma_rate = calculateKarmaRate(sleeve)

        if best_training.benefitPerHour > current_karma_rate:
            return best_training.action

    // Default to best available crime
    if homicide_success_rate > 25%:
        return CRIME_HOMICIDE
    else:
        return CRIME_MUG
```

## Practical Recommendations

### Early Game (High Shock, Low Stats)

1. **Shock recovery until < 50%** (training is too inefficient at high shock)
2. **Burst training** in most beneficial stat (usually strength/defense)
3. **Switch to crime** once break-even analysis favors it

### Mid Game (Medium Shock, Medium Stats)

1. **Use break-even analysis** for every decision
2. **Training often wins** due to logarithmic scaling
3. **Focus on strength/defense** (highest weights in homicide formula)

### Late Game (Low Shock, High Stats)

1. **Primarily crime** for direct karma
2. **Selective training** only when marginal benefits are very high
3. **Shock recovery** only if it significantly improves crime rates

## Mathematical Formulas

### Break-Even Time for Training

```
break_even_time = karma_lost_during_training / karma_rate_improvement_per_second
```

### Karma Rate Improvement from Stat Training

```
improvement = karma_rate_after_training - karma_rate_before_training
```

### Training Efficiency (Karma per Training Second)

```
efficiency = future_karma_benefit / training_time_required
```

## Key Takeaways

1. **Training can be more valuable than crime** when success rates are low
2. **Break-even analysis is essential** - intuition often fails
3. **Shock penalty makes training less attractive** at high shock levels
4. **Logarithmic scaling means early training is very efficient**
5. **Compound returns make stat investment worthwhile** even at opportunity cost

The optimization model provides a rigorous framework for making these complex tradeoff decisions in real-time based on current sleeve state.
