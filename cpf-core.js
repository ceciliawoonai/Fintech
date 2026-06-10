/**
 * CPF Core Calculation Module
 * Contains all CPF calculation logic and formulas
 */

// CPF Constants (2026 values)
const CPF_CONSTANTS = {
  BRS: 102900,  // Basic Retirement Sum
  FRS: 205800,  // Full Retirement Sum
  ERS: 308700,  // Enhanced Retirement Sum
  OA_INTEREST: 0.025,  // 2.5% for Ordinary Account
  SA_RA_INTEREST: 0.04, // 4.0% for Special and Retirement Accounts
  MA_INTEREST: 0.04,   // 4.0% for MediSave Account
  EMPLOYEE_RATES: {
    20: 0.20,  // 20% for ages ≤ 55
    55: 0.17,  // 17% for ages 55-60
    60: 0.115, // 11.5% for ages 60-65
    65: 0.075, // 7.5% for ages 65-70
    70: 0.05   // 5% for ages 70+
  }
};

// CPF Allocation Rates by Age
const CPF_ALLOCATION_RATES = {
  20: { oa: 62.17, sa: 16.21, ma: 21.62, total: 37, strategy: "🏠 Maximizing housing runway" },
  25: { oa: 62.17, sa: 16.21, ma: 21.62, total: 37, strategy: "🏠 Maximizing housing runway" },
  30: { oa: 62.17, sa: 16.21, ma: 21.62, total: 37, strategy: "🏠 Maximizing housing runway" },
  35: { oa: 62.17, sa: 16.21, ma: 21.62, total: 37, strategy: "🏠 Maximizing housing runway" },
  40: { oa: 56.77, sa: 18.91, ma: 24.32, total: 37, strategy: "📉 OA drops; SA/MA start to climb" },
  45: { oa: 51.36, sa: 21.62, ma: 27.02, total: 37, strategy: "⚖️ Balanced accumulation phase" },
  50: { oa: 40.55, sa: 31.08, ma: 28.37, total: 37, strategy: "🛡️ Aggressive retirement build-up" },
  55: { oa: 12.0,  sa: 0,     ma: 10.5,  total: 34, strategy: "🔒 SA closed, RA created" },
  60: { oa: 3.5,   sa: 0,     ma: 10.5,  total: 25, strategy: "🎯 Retirement focus" },
  65: { oa: 1.0,   sa: 0,     ma: 10.5,  total: 16.5, strategy: "👵 Reduced contributions" },
  70: { oa: 1.0,   sa: 0,     ma: 10.5,  total: 12.5, strategy: "🦽 Minimum contributions" }
};

// Retirement Account allocation rates for ages 55+
const RA_ALLOCATION_RATES = {
  55: 11.5,
  60: 11.0,
  65: 5.0,
  70: 1.0
};

/**
 * Get CPF allocation rates based on age
 * @param {number} age - Current age
 * @returns {Object} Allocation rates object
 */
function getAllocationRates(age) {
  // Find the closest age bracket
  const ages = Object.keys(CPF_ALLOCATION_RATES).map(Number).sort((a, b) => a - b);
  let closestAge = 35;

  for (let i = 0; i < ages.length; i++) {
    if (age <= ages[i]) {
      closestAge = ages[i];
      break;
    }
  }

  return CPF_ALLOCATION_RATES[closestAge];
}

/**
 * Calculate monthly CPF contributions
 * @param {number} salary - Monthly salary
 * @param {number} age - Current age
 * @param {number} contributionRate - Total contribution rate (decimal)
 * @returns {Object} Contribution breakdown
 */
function calculateContributions(salary, age, contributionRate) {
  const rates = getAllocationRates(age);
  const totalContribution = salary * contributionRate;

  // Calculate account contributions
  const oaContribution = totalContribution * (rates.oa / 100);
  const saContribution = totalContribution * (rates.sa / 100);
  const maContribution = totalContribution * (rates.ma / 100);

  // Calculate employee/employer split
  const employeeRate = age <= 55 ? 0.2 :
                      age <= 60 ? 0.17 :
                      age <= 65 ? 0.115 :
                      age <= 70 ? 0.075 : 0.05;
  const employerRate = contributionRate - employeeRate;

  return {
    total: totalContribution,
    oa: oaContribution,
    sa: saContribution,
    ma: maContribution,
    employee: salary * employeeRate,
    employer: salary * employerRate,
    rates: rates
  };
}

/**
 * Project CPF balances to retirement age
 * @param {number} currentBalance - Current account balance
 * @param {number} monthlyContribution - Monthly contribution amount
 * @param {number} yearsToRetirement - Years until retirement
 * @param {number} interestRate - Annual interest rate (decimal)
 * @returns {number} Projected balance at retirement
 */
function projectBalance(currentBalance, monthlyContribution, yearsToRetirement, interestRate) {
  // Future Value of Annuity Due formula
  const annuityFactor = (Math.pow(1 + interestRate, yearsToRetirement) - 1) / interestRate * (1 + interestRate);
  const futureValue = currentBalance * Math.pow(1 + interestRate, yearsToRetirement) + (monthlyContribution * 12 * annuityFactor);
  return futureValue;
}

/**
 * Calculate CPF projections
 * @param {Object} inputs - Input parameters
 * @returns {Object} Complete CPF calculation results
 */
function calculateCPFProjections(inputs) {
  const {
    age,
    salary,
    contributionRate,
    oaBalance,
    saBalance,
    maBalance,
    raBalance = 0,
    awsBonus = 0,
    bonusMonths = 1
  } = inputs;

  // Calculate annual wage components
  const annualSalary = salary * 12;
  const annualBonus = awsBonus * bonusMonths;
  const grossAnnualWage = annualSalary + annualBonus;

  // Get contribution breakdown
  const contributions = calculateContributions(salary, age, contributionRate);

  // Apply FRS exception rule for ages 55+
  let frsExceptionApplied = false;
  let finalOaContribution = contributions.oa;
  let finalSaContribution = contributions.sa;

  if (age >= 55 && raBalance >= CPF_CONSTANTS.FRS) {
    finalOaContribution += finalSaContribution;
    finalSaContribution = 0;
    frsExceptionApplied = true;
  }

  // Calculate years to retirement
  const yearsToRetirement = 65 - age;

  // Project balances for each account
  const projectedOa = projectBalance(oaBalance, finalOaContribution, yearsToRetirement, CPF_CONSTANTS.OA_INTEREST);
  const projectedSa = projectBalance(saBalance, finalSaContribution, yearsToRetirement, CPF_CONSTANTS.SA_RA_INTEREST);
  const projectedMa = projectBalance(maBalance, contributions.ma, yearsToRetirement, CPF_CONSTANTS.MA_INTEREST);
  const projectedRa = age >= 55
    ? Math.min(projectBalance(raBalance, finalSaContribution, yearsToRetirement, CPF_CONSTANTS.SA_RA_INTEREST), CPF_CONSTANTS.FRS)
    : 0;

  // Prepare results
  const results = {
    wage: {
      grossAnnual: grossAnnualWage,
      annualSalary: annualSalary,
      annualBonus: annualBonus
    },
    contributions: {
      totalMonthly: contributions.total,
      oaMonthly: finalOaContribution,
      saMonthly: finalSaContribution,
      maMonthly: contributions.ma,
      employeeMonthly: contributions.employee,
      employerMonthly: contributions.employer
    },
    projections: {},
    summary: {
      frsStatus: raBalance >= CPF_CONSTANTS.FRS ? 'REACHED' : 'NOT REACHED',
      frsProgress: age >= 55 ? ((raBalance / CPF_CONSTANTS.FRS) * 100).toFixed(1) + '%' : 'N/A',
      frsExceptionApplied: frsExceptionApplied
    },
    metadata: {
      age: age,
      yearsToRetirement: yearsToRetirement,
      allocationStrategy: contributions.rates.strategy
    }
  };

  // Add projections based on age
  if (age >= 55) {
    // For ages 55+, show RA instead of SA
    results.projections = {
      oaAt65: projectedOa,
      raAt65: projectedRa,
      maAt65: projectedMa,
      totalAt65: projectedOa + projectedRa + projectedMa
    };
  } else {
    // For ages < 55, show SA and projected RA conversion
    results.projections = {
      oaAt54: projectedOa,
      saAt54: projectedSa,
      maAt54: projectedMa,
      totalAt54: projectedOa + projectedSa + projectedMa
    };

    // Project to age 65 (after SA->RA conversion at 55)
    const yearsFrom55To65 = 10;
    const saToRaConversion = projectedSa;
    const raAt65 = projectBalance(saToRaConversion, finalSaContribution, yearsFrom55To65, CPF_CONSTANTS.SA_RA_INTEREST);
    const oaAt65 = projectBalance(projectedOa, finalOaContribution, yearsFrom55To65, CPF_CONSTANTS.OA_INTEREST);
    const maAt65 = projectBalance(projectedMa, contributions.ma, yearsFrom55To65, CPF_CONSTANTS.MA_INTEREST);

    results.projections.oaAt65 = oaAt65;
    results.projections.raAt65 = raAt65;
    results.projections.maAt65 = maAt65;
    results.projections.totalAt65 = oaAt65 + raAt65 + maAt65;
  }

  return results;
}

/**
 * Calculate retirement projections
 * @param {Object} inputs - Retirement input parameters
 * @returns {Object} Retirement projection results
 */
function calculateRetirementProjections(inputs) {
  const {
    retirementAge,
    lifeExpectancy,
    returnRate,
    desiredPayout,
    cpfLifePlan,
    oaBalance,
    saBalance,
    maBalance
  } = inputs;

  const totalCpf = oaBalance + saBalance + maBalance;
  const retirementYears = lifeExpectancy - retirementAge;

  // Future Value calculation
  const fvFactor = Math.pow(1 + returnRate, retirementYears);
  const retirementSum = totalCpf * fvFactor;

  // CPF Life payout calculation
  let monthlyPayout = 0;
  if (cpfLifePlan === 'standard') {
    monthlyPayout = retirementSum / (retirementYears * 12 * 1.1);
  } else if (cpfLifePlan === 'basic') {
    monthlyPayout = retirementSum / (retirementYears * 12 * 1.2);
  } else {
    // Escalating plan
    monthlyPayout = desiredPayout;
  }

  return {
    retirementSum: retirementSum,
    retirementPeriod: retirementYears,
    projectedPayout: monthlyPayout,
    totalPayouts: monthlyPayout * 12 * retirementYears,
    shortfall: desiredPayout - monthlyPayout,
    payoutPlan: cpfLifePlan
  };
}

// Export functions for use in main application
export {
  CPF_CONSTANTS,
  CPF_ALLOCATION_RATES,
  RA_ALLOCATION_RATES,
  getAllocationRates,
  calculateContributions,
  projectBalance,
  calculateCPFProjections,
  calculateRetirementProjections
};