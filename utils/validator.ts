
import { AggregatedData, FileDiscountBreakdown, ParsedSale11004, ParsedSummary11008, ParsedSystemEvent, SaleHeader, SaleItemLine, SingleFileInspection, ValidationResult } from "../types";

// Format money for display (divide by 1000)
// Using 3 decimals to show full precision (mills) as per AENA spec
export const fmtMoney = (val: number) => (val / 1000).toFixed(3);

// Calculate total item discount including line discounts AND prorated header discounts
export const calculateTotalItemDiscount = (item: SaleItemLine, header: SaleHeader): number => {
    const lineDiscount = item.IMPDESCUENTO_1 + item.IMPDESCUENTO_2 + item.IMPDESCUENTO_3;
    
    // AutoIt Logic from vrfContarUdsTotales / SubfamiliasParser
    // Discounts are applied in cascade:
    // Base = ImporteVenta (Index 9) - LineDiscounts
    // D1 = Base * (HeaderPerc1 / 10000)
    // Base = Base - D1
    // D2 = Base * (HeaderPerc2 / 10000)
    // Base = Base - D2
    // D3 = Base * (HeaderPerc3 / 10000)
    
    let base = item.IMPVENTA_A - lineDiscount;
    
    // Header DTO 1
    let d1 = 0;
    if (header.DTO_PORC_1 && header.DTO_PORC_1 !== 0) {
        d1 = base * (header.DTO_PORC_1 / 10000);
        base = base - d1;
    }

    // Header DTO 2
    let d2 = 0;
    if (header.DTO_PORC_2 && header.DTO_PORC_2 !== 0) {
        d2 = base * (header.DTO_PORC_2 / 10000);
        base = base - d2;
    }

    // Header DTO 3
    let d3 = 0;
    if (header.DTO_PORC_3 && header.DTO_PORC_3 !== 0) {
        d3 = base * (header.DTO_PORC_3 / 10000);
    }
    
    const proratedHeaderDiscount = d1 + d2 + d3;
    
    return lineDiscount + proratedHeaderDiscount;
};

// NEW: Single File Internal Inspection
export const inspectSingleFile = (file: ParsedSale11004): SingleFileInspection => {
    let sumGross = 0;
    let sumNet = 0;
    let sumDiscount = 0;
    let sumUnits = 0;
    
    // Item Sums
    file.items.forEach(item => {
        sumGross += item.IMPBRUTO_A;
        sumNet += item.IMPNETO_A;
        sumUnits += item.UDS_A;
        sumDiscount += calculateTotalItemDiscount(item, file.header);
    });

    // Payment Sums (7xx)
    let sumPayments = 0;
    file.payments.forEach(p => sumPayments += p.IMPORTE);

    // Tax Sums (6xx)
    let sumTaxes = 0;
    file.taxes.forEach(t => sumTaxes += t.CUOTA);

    const checks = [];

    // 1. Gross Amount (Critical)
    checks.push({
        label: "Total Gross Amount (IMPBRUTO)",
        headerValue: fmtMoney(file.header.IMPBRUTO_T),
        calcValue: fmtMoney(sumGross),
        diff: fmtMoney(file.header.IMPBRUTO_T - sumGross),
        isOk: file.header.IMPBRUTO_T === sumGross
    });

    // 2. Net Amount (Critical)
    checks.push({
        label: "Total Net Amount (IMPNETO)",
        headerValue: fmtMoney(file.header.IMPNETO_T),
        calcValue: fmtMoney(sumNet),
        diff: fmtMoney(file.header.IMPNETO_T - sumNet),
        isOk: file.header.IMPNETO_T === sumNet
    });

    // 3. Tax Amount Check (NEW)
    checks.push({
        label: "Total Tax (6xx vs Header)",
        headerValue: fmtMoney(file.header.IMPIMPUESTOS_T),
        calcValue: fmtMoney(sumTaxes),
        diff: fmtMoney(file.header.IMPIMPUESTOS_T - sumTaxes),
        isOk: Math.abs(file.header.IMPIMPUESTOS_T - sumTaxes) < 50 // Tolerance for rounding
    });

    // 4. Payments Check (NEW)
    checks.push({
        label: "Total Payments (7xx vs Gross)",
        headerValue: fmtMoney(file.header.IMPBRUTO_T),
        calcValue: fmtMoney(sumPayments),
        diff: fmtMoney(file.header.IMPBRUTO_T - sumPayments),
        isOk: Math.abs(file.header.IMPBRUTO_T - sumPayments) < 50 // Tolerance
    });

    // 5. Units Check (Critical)
    checks.push({
        label: "Total Units (N_UDS vs Sum UDS_A)",
        headerValue: file.header.N_UDS,
        calcValue: sumUnits,
        diff: file.header.N_UDS - sumUnits,
        isOk: file.header.N_UDS === sumUnits
    });

    // 6. Discount Check (Warning Only)
    const diffDisc = Math.abs(file.header.IMPDESCUENTO_T - sumDiscount);
    const isDiscMatch = diffDisc < 100; 
    
    checks.push({
        label: "Total Discount (Informational)",
        headerValue: fmtMoney(file.header.IMPDESCUENTO_T),
        calcValue: fmtMoney(sumDiscount),
        diff: fmtMoney(file.header.IMPDESCUENTO_T - sumDiscount),
        isOk: true, 
        isWarning: !isDiscMatch
    });

    return {
        fileName: file.fileName,
        ticketNum: file.header.NUM_TICKET,
        checks,
        lines: file.items,
        taxes: file.taxes,
        payments: file.payments
    };
};


// NEW: Generates a detailed breakdown of discounts per file and subfamily
export const generateDiscountBreakdown = (sales: ParsedSale11004[]): FileDiscountBreakdown[] => {
    return sales.map(file => {
        const subFamilyMap: Record<number, { discount: number, gross: number, base: number }> = {};

        file.items.forEach(item => {
            const disc = calculateTotalItemDiscount(item, file.header);
            
            if (!subFamilyMap[item.TIPO_SUBFAMILIA]) {
                subFamilyMap[item.TIPO_SUBFAMILIA] = { discount: 0, gross: 0, base: 0 };
            }
            
            subFamilyMap[item.TIPO_SUBFAMILIA].discount += disc;
            subFamilyMap[item.TIPO_SUBFAMILIA].gross += item.IMPBRUTO_A;
            subFamilyMap[item.TIPO_SUBFAMILIA].base += item.IMPVENTA_A;
        });

        // Convert map to array
        const subFamilies = Object.entries(subFamilyMap).map(([id, val]) => ({
            id: Number(id),
            discount: val.discount,
            gross: val.gross,
            base: val.base
        })).sort((a, b) => a.id - b.id);

        return {
            fileName: file.fileName,
            ticketNum: file.header.NUM_TICKET,
            isReturn: file.header.TIPO_VENTA === 2,
            subFamilies
        };
    });
};

export const aggregateSales = (sales: ParsedSale11004[]): AggregatedData => {
  const data: AggregatedData = {
    groups: {},
    global: {
      totalGrossSale: 0,
      totalNetSale: 0,
      totalDiscountSale: 0,
      countSale: 0,
      minTicket: Number.MAX_SAFE_INTEGER,
      maxTicket: 0,
      totalGrossReturn: 0,
      totalNetReturn: 0,
      totalDiscountReturn: 0,
      countReturn: 0,
    }
  };

  sales.forEach(sale => {
    const isSale = sale.header.TIPO_VENTA === 1;
    const isReturn = sale.header.TIPO_VENTA === 2;
    const ticketNum = parseInt(sale.header.NUM_TICKET);

    // Track Ticket Range (Strict Boundary Check)
    if (!isNaN(ticketNum)) {
        if (ticketNum < data.global.minTicket) data.global.minTicket = ticketNum;
        if (ticketNum > data.global.maxTicket) data.global.maxTicket = ticketNum;
    }

    // 1. Global Aggregation (Counters)
    if (isSale) {
      data.global.countSale++;
      data.global.totalGrossSale += sale.header.IMPBRUTO_T;
      data.global.totalNetSale += sale.header.IMPNETO_T;
    } else if (isReturn) {
      data.global.countReturn++;
      data.global.totalGrossReturn += sale.header.IMPBRUTO_T;
      data.global.totalNetReturn += sale.header.IMPNETO_T;
    }
    
    // 2. Detailed Aggregation (Items)
    sale.items.forEach(item => {
      const key = String(item.TIPO_SUBFAMILIA);
      
      if (!data.groups[key]) {
        data.groups[key] = {
          subFamily: item.TIPO_SUBFAMILIA,
          grossSale: 0, netSale: 0, discountSale: 0, qtySale: 0,
          grossReturn: 0, netReturn: 0, discountReturn: 0, qtyReturn: 0,
        };
      }

      const totalItemDiscount = calculateTotalItemDiscount(item, sale.header);

      if (isSale) {
         data.global.totalDiscountSale += totalItemDiscount; 
         
         data.groups[key].grossSale += item.IMPBRUTO_A;
         data.groups[key].netSale += item.IMPNETO_A;
         data.groups[key].discountSale += totalItemDiscount;
         data.groups[key].qtySale += item.UDS_A; 
      } else if (isReturn) {
         data.global.totalDiscountReturn += totalItemDiscount; 

         data.groups[key].grossReturn += item.IMPBRUTO_A;
         data.groups[key].netReturn += item.IMPNETO_A;
         data.groups[key].discountReturn += totalItemDiscount;
         data.groups[key].qtyReturn += item.UDS_A;
      }
    });
  });

  if (data.global.minTicket === Number.MAX_SAFE_INTEGER) data.global.minTicket = 0;

  return data;
};

export const validateCoherence = (
  salesData: AggregatedData, 
  summary: ParsedSummary11008,
  startDay?: ParsedSystemEvent,
  endDay?: ParsedSystemEvent,
  allSalesFiles?: ParsedSale11004[]
): ValidationResult[] => {
  const results: ValidationResult[] = [];
  const passedChecks: { field: string, expected: string | number, actual: string | number, context: string }[] = [];

  // --- 0. Date Consistency Check (NEW) ---
  const masterDate = summary.header.FECHA_REAL;
  if (allSalesFiles) {
      const invalidDateFiles = allSalesFiles.filter(f => f.header.FECHA_REAL !== masterDate);
      if (invalidDateFiles.length > 0) {
           results.push({
            status: 'invalid',
            message: `Date Mismatch: ${invalidDateFiles.length} files have a different date than the Summary (${masterDate})`,
            details: invalidDateFiles.slice(0, 5).map(f => ({
                field: 'FECHA_REAL',
                expected: masterDate,
                actual: f.header.FECHA_REAL,
                context: f.fileName
            }))
          });
      } else {
          passedChecks.push({ field: 'FECHA_REAL', expected: masterDate, actual: 'Match', context: 'All Files Date Check' });
      }
  }

  // --- 1. Z Number Consistency (VrfZ) ---
  const zCheckList: { name: string, val: string }[] = [];
  if (summary) zCheckList.push({ name: 'Summary (11008)', val: summary.header.NUM_Z });
  if (startDay) zCheckList.push({ name: 'Start Day (11001)', val: startDay.header.NUM_Z });
  if (endDay) zCheckList.push({ name: 'End Day (11002)', val: endDay.header.NUM_Z });

  if (zCheckList.length > 1) {
      const referenceZ = zCheckList[0].val;
      const mismatches = zCheckList.filter(item => item.val !== referenceZ);

      if (mismatches.length > 0) {
           results.push({
            status: 'invalid',
            message: `Z Number Mismatch across files`,
            details: zCheckList.map(item => ({
                field: 'NUM_Z',
                expected: referenceZ,
                actual: item.val,
                context: item.name
            }))
          });
      } else {
           passedChecks.push({ field: 'NUM_Z', expected: referenceZ, actual: 'Consistent', context: `Across ${zCheckList.length} Files` });
      }
  }

  // --- 2. 11008 Internal Coherence (Header vs Body) (NEW) ---
  let sum11008_GrossV = 0;
  let sum11008_GrossD = 0;

  summary.aggregations.forEach(row => {
      sum11008_GrossV += row.IMPBRUTO_VSFZ;
      sum11008_GrossD += row.IMPBRUTO_DSFZ;
  });

  let internal11008Ok = true;
  if (sum11008_GrossV !== summary.header.IMPBRUTO_V) {
      results.push({ 
          status: 'invalid', 
          message: '11008 Internal Inconsistency: Sum of Subfamilies (Sales) != Header Total', 
          details: [{ field: 'IMPBRUTO_V', expected: fmtMoney(sum11008_GrossV), actual: fmtMoney(summary.header.IMPBRUTO_V), context: '11008 Internal' }]
      });
      internal11008Ok = false;
  }
  if (sum11008_GrossD !== summary.header.IMPBRUTO_D) {
      results.push({ 
          status: 'invalid', 
          message: '11008 Internal Inconsistency: Sum of Subfamilies (Returns) != Header Total', 
          details: [{ field: 'IMPBRUTO_D', expected: fmtMoney(sum11008_GrossD), actual: fmtMoney(summary.header.IMPBRUTO_D), context: '11008 Internal' }]
      });
      internal11008Ok = false;
  }
  if (internal11008Ok) {
      passedChecks.push({ field: 'Structure', expected: 'Header == Sum(Body)', actual: 'Verified', context: '11008 Internal Integrity' });
  }

  // --- 3. 11004 Internal Coherence (Header vs Body) (NEW) ---
  if (allSalesFiles) {
      let filesWithError = 0;
      allSalesFiles.forEach(file => {
          let fileGross = 0;
          let fileNet = 0;
          file.items.forEach(item => {
              fileGross += item.IMPBRUTO_A;
              fileNet += item.IMPNETO_A;
          });

          if (fileGross !== file.header.IMPBRUTO_T || fileNet !== file.header.IMPNETO_T) {
              filesWithError++;
              results.push({
                  status: 'invalid',
                  message: `Ticket Internal Math Error: ${file.header.NUM_TICKET}`,
                  details: [{ field: 'IMPBRUTO/NETO', expected: fmtMoney(fileGross), actual: fmtMoney(file.header.IMPBRUTO_T), context: file.fileName }]
              });
          }
      });
      if (filesWithError === 0 && allSalesFiles.length > 0) {
          passedChecks.push({ field: 'Ticket Math', expected: 'Header == Sum(Lines)', actual: `${allSalesFiles.length} Tickets OK`, context: '11004 Internal Integrity' });
      }
  }

  // --- 4. Global Counters (VrfNumeroTiquetsPosNeg) ---
  const globalChecks = [
      { field: 'N_VENTAS', label: 'Sales Count', val: salesData.global.countSale, ref: summary.header.N_VENTAS },
      { field: 'IMPBRUTO_V', label: 'Gross Sales', val: salesData.global.totalGrossSale, ref: summary.header.IMPBRUTO_V, isMoney: true },
      { field: 'N_DEVOLUCIONES', label: 'Returns Count', val: salesData.global.countReturn, ref: summary.header.N_DEVOLUCIONES },
      { field: 'IMPBRUTO_D', label: 'Gross Returns', val: salesData.global.totalGrossReturn, ref: summary.header.IMPBRUTO_D, isMoney: true },
  ];

  globalChecks.forEach(chk => {
      if (chk.val !== chk.ref) {
          results.push({
              status: 'invalid',
              message: `Global Mismatch: ${chk.label}`,
              details: [{ field: chk.field, expected: chk.isMoney ? fmtMoney(chk.val) : chk.val, actual: chk.isMoney ? fmtMoney(chk.ref) : chk.ref, context: '11004 vs 11008' }]
          });
      } else {
          passedChecks.push({ field: chk.field, expected: chk.isMoney ? fmtMoney(chk.ref) : chk.ref, actual: 'Match', context: 'Global Counters' });
      }
  });
  
  // NEW: Global Discount Checks (with tolerance)
  const globalDiscountChecks = [
      { field: 'IMPDESCUENTO_V', label: 'Total Discount Sales', val: salesData.global.totalDiscountSale, ref: summary.header.IMPDESCUENTO_V },
      { field: 'IMPDESCUENTO_D', label: 'Total Discount Returns', val: salesData.global.totalDiscountReturn, ref: summary.header.IMPDESCUENTO_D },
  ];

  globalDiscountChecks.forEach(chk => {
       const diff = Math.abs(chk.val - chk.ref);
       if (diff >= 100) { 
           results.push({
               status: 'invalid',
               message: `Global Mismatch: ${chk.label}`,
               details: [{ field: chk.field, expected: fmtMoney(chk.ref), actual: fmtMoney(chk.val), context: '11004 vs 11008 (Global)' }]
           });
       } else {
           passedChecks.push({ field: chk.field, expected: fmtMoney(chk.ref), actual: 'Match', context: 'Global Discounts' });
       }
  });

  // --- 4.1 Ticket Range Check (CD_TICKET_I / F) ---
  const tStart = parseInt(summary.header.CD_TICKET_I);
  const tEnd = parseInt(summary.header.CD_TICKET_F);
  const rStart = salesData.global.minTicket;
  const rEnd = salesData.global.maxTicket;

  if (tStart !== rStart) {
      results.push({
          status: 'invalid',
          message: 'Initial Ticket Mismatch (CD_TICKET_I)',
          details: [{ field: 'CD_TICKET_I', expected: tStart, actual: rStart, context: 'Boundary Check (First Found)' }]
      });
  } else {
      passedChecks.push({ field: 'CD_TICKET_I', expected: tStart, actual: rStart, context: 'Ticket Range Start' });
  }

  if (tEnd !== rEnd) {
      results.push({
          status: 'invalid',
          message: 'Final Ticket Mismatch (CD_TICKET_F)',
          details: [{ field: 'CD_TICKET_F', expected: tEnd, actual: rEnd, context: 'Boundary Check (Last Found)' }]
      });
  } else {
      passedChecks.push({ field: 'CD_TICKET_F', expected: tEnd, actual: rEnd, context: 'Ticket Range End' });
  }


  // --- 5. Subfamily Aggregations (vrfSubFamilias) ---
  const summaryBySubFamily: Record<string, { 
      uds: number, impBruto: number, impNeto: number, impDesc: number, 
      udsD: number, impBrutoD: number, impNetoD: number, impDescD: number 
  }> = {};

  summary.aggregations.forEach(line => {
      const key = String(line.TIPO_SUBFAMILIA);
      if (!summaryBySubFamily[key]) {
          summaryBySubFamily[key] = { uds: 0, impBruto: 0, impNeto: 0, impDesc: 0, udsD: 0, impBrutoD: 0, impNetoD: 0, impDescD: 0 };
      }
      summaryBySubFamily[key].uds += line.ARTICULOS_V;
      summaryBySubFamily[key].impBruto += line.IMPBRUTO_VSFZ;
      summaryBySubFamily[key].impNeto += line.IMPNETO_VSFZ;
      summaryBySubFamily[key].impDesc += line.IMPDESCUENTO_VSFZ;
      
      summaryBySubFamily[key].udsD += line.ARTICULOS_D;
      summaryBySubFamily[key].impBrutoD += line.IMPBRUTO_DSFZ;
      summaryBySubFamily[key].impNetoD += line.IMPNETO_DSFZ;
      summaryBySubFamily[key].impDescD += line.IMPDESCUENTO_DSFZ;
  });

  let subfamiliesError = false;
  let subfamiliesChecked = 0;

  // CHECK 1: Sales -> Summary (Missing in 11008?)
  Object.keys(salesData.groups).forEach(key => {
    subfamiliesChecked++;
    const calc = salesData.groups[key];
    const sumLine = summaryBySubFamily[key];

    if (!sumLine) {
        subfamiliesError = true;
        results.push({
            status: 'invalid',
            message: `SubFamily Mismatch: ID ${key} found in Sales but missing in Summary`,
            details: [{ field: 'SubFamily', expected: 'Present in 11008', actual: 'Missing', context: `SubFamily ${key}` }]
        });
        return;
    }

    const checks = [
        { name: 'UDS', c: calc.qtySale, s: sumLine.uds },
        { name: 'IMPBRUTO', c: calc.grossSale, s: sumLine.impBruto },
        { name: 'IMPNETO', c: calc.netSale, s: sumLine.impNeto },
        { name: 'UDS_D', c: calc.qtyReturn, s: sumLine.udsD },
        { name: 'IMPBRUTO_D', c: calc.grossReturn, s: sumLine.impBrutoD },
        { name: 'IMPNETO_D', c: calc.netReturn, s: sumLine.impNetoD }, 
    ];

    checks.forEach(k => {
        if (k.c !== k.s) {
            subfamiliesError = true;
            results.push({ status: 'invalid', message: `${k.name} Mismatch SubFamily ${key}`, details: [{ field: k.name, expected: k.name.includes('IMP') ? fmtMoney(k.c) : k.c, actual: k.name.includes('IMP') ? fmtMoney(k.s) : k.s, context: `SubFamily ${key}` }] });
        }
    });
    
    // Discount Check (Sales)
    const diffDesc = Math.abs(calc.discountSale - sumLine.impDesc);
    if (diffDesc >= 100) {
        subfamiliesError = true;
        results.push({ 
            status: 'invalid', 
            message: `Discount Sales Mismatch SubFamily ${key}`, 
            details: [{ 
                field: 'IMPDESCUENTO_VSFZ', 
                expected: fmtMoney(sumLine.impDesc), 
                actual: fmtMoney(calc.discountSale), 
                context: `SubFamily ${key} (Exp: 11008 Line vs Act: 11004 Sum)` 
            }] 
        });
    }

    // Discount Check (Returns)
    const diffDescD = Math.abs(calc.discountReturn - sumLine.impDescD);
    if (diffDescD >= 100) {
        subfamiliesError = true;
        results.push({ 
            status: 'invalid', 
            message: `Discount Returns Mismatch SubFamily ${key}`, 
            details: [{ 
                field: 'IMPDESCUENTO_DSFZ', 
                expected: fmtMoney(sumLine.impDescD), 
                actual: fmtMoney(calc.discountReturn), 
                context: `SubFamily ${key} (Exp: 11008 Line vs Act: 11004 Sum)` 
            }] 
        });
    }
  });

  // CHECK 2: Summary -> Sales (Ghost Subfamilies in 11008?)
  Object.keys(summaryBySubFamily).forEach(key => {
      if (!salesData.groups[key]) {
          subfamiliesError = true;
           results.push({
            status: 'invalid',
            message: `SubFamily Mismatch: ID ${key} found in Summary but no Sales detected (Ghost Data)`,
            details: [{ field: 'SubFamily', expected: 'Present in 11004', actual: 'Missing', context: `SubFamily ${key}` }]
        });
      }
  });

  if (!subfamiliesError && subfamiliesChecked > 0) {
      passedChecks.push({ field: 'Subfamilies', expected: 'Full Match', actual: `${subfamiliesChecked} Groups Verified`, context: 'Detailed Aggregation' });
  }

  const invalidResults = results.filter(r => r.status === 'invalid');
  
  if (invalidResults.length === 0) {
    return [{ 
        status: 'valid', 
        message: 'All coherence checks passed successfully.',
        details: passedChecks
    }];
  }

  return results;
};
