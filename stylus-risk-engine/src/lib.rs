#![cfg_attr(not(test), no_std)]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum RiskDecision {
    Allowed = 0,
    PolicyInactive = 1,
    PolicyExpired = 2,
    CooldownActive = 3,
    SpendLimitExceeded = 4,
    MonthlyCapExceeded = 5,
    SlippageExceeded = 6,
    ReserveViolated = 7,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RiskInput {
    pub active: bool,
    pub amount: u128,
    pub spend_limit: u128,
    pub monthly_cap: u128,
    pub spent_this_period: u128,
    pub quoted_slippage_bps: u16,
    pub max_slippage_bps: u16,
    pub projected_reserve: u128,
    pub minimum_reserve: u128,
    pub now: u64,
    pub last_executed_at: u64,
    pub cooldown_seconds: u64,
    pub expires_at: u64,
}

pub fn evaluate_policy(input: RiskInput) -> RiskDecision {
    if !input.active {
        return RiskDecision::PolicyInactive;
    }

    if input.now >= input.expires_at {
        return RiskDecision::PolicyExpired;
    }

    if input.last_executed_at != 0 && input.now < input.last_executed_at.saturating_add(input.cooldown_seconds) {
        return RiskDecision::CooldownActive;
    }

    if input.amount == 0 || input.amount > input.spend_limit {
        return RiskDecision::SpendLimitExceeded;
    }

    if input.spent_this_period.saturating_add(input.amount) > input.monthly_cap {
        return RiskDecision::MonthlyCapExceeded;
    }

    if input.quoted_slippage_bps > input.max_slippage_bps {
        return RiskDecision::SlippageExceeded;
    }

    if input.projected_reserve < input.minimum_reserve {
        return RiskDecision::ReserveViolated;
    }

    RiskDecision::Allowed
}

#[no_mangle]
pub extern "C" fn rail_evaluate_policy(
    active: bool,
    amount: u128,
    spend_limit: u128,
    monthly_cap: u128,
    spent_this_period: u128,
    quoted_slippage_bps: u16,
    max_slippage_bps: u16,
    projected_reserve: u128,
    minimum_reserve: u128,
    now: u64,
    last_executed_at: u64,
    cooldown_seconds: u64,
    expires_at: u64,
) -> u8 {
    evaluate_policy(RiskInput {
        active,
        amount,
        spend_limit,
        monthly_cap,
        spent_this_period,
        quoted_slippage_bps,
        max_slippage_bps,
        projected_reserve,
        minimum_reserve,
        now,
        last_executed_at,
        cooldown_seconds,
        expires_at,
    }) as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_input() -> RiskInput {
        RiskInput {
            active: true,
            amount: 20,
            spend_limit: 20,
            monthly_cap: 100,
            spent_this_period: 40,
            quoted_slippage_bps: 80,
            max_slippage_bps: 100,
            projected_reserve: 80,
            minimum_reserve: 50,
            now: 1_000,
            last_executed_at: 0,
            cooldown_seconds: 604_800,
            expires_at: 2_000,
        }
    }

    #[test]
    fn allows_valid_policy() {
        assert_eq!(evaluate_policy(valid_input()), RiskDecision::Allowed);
    }

    #[test]
    fn blocks_overspend() {
        let mut input = valid_input();
        input.amount = 21;
        assert_eq!(evaluate_policy(input), RiskDecision::SpendLimitExceeded);
    }

    #[test]
    fn blocks_slippage() {
        let mut input = valid_input();
        input.quoted_slippage_bps = 150;
        assert_eq!(evaluate_policy(input), RiskDecision::SlippageExceeded);
    }

    #[test]
    fn blocks_reserve_violation() {
        let mut input = valid_input();
        input.projected_reserve = 49;
        assert_eq!(evaluate_policy(input), RiskDecision::ReserveViolated);
    }
}
