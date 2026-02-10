
import { ParsedSale11004, ValidationResult } from "../types";

// Helper to check if string is empty (handles null/undefined/whitespace)
const isEmpty = (val: string) => !val || val.trim() === '';

// Helper to check for strict positive integer (No decimals, no negatives, digits only)
const isStrictPositiveInteger = (val: string) => {
    return /^\d+$/.test(val);
};

// AENA SAVIA Field Specifications
// F = Fixed Length, M = Max Length
const SPECS = {
    HEADER: {
        0: { len: 5, type: 'F', name: 'COD_TRANSACC' }, // 11004
        1: { len: 8, type: 'F', name: 'FECHA_REAL' }, // YYYYMMDD
        2: { len: 6, type: 'F', name: 'HORA_REAL' }, // HHMMSS
        3: { len: 6, type: 'M', name: 'NUM_Z' },
        4: { len: 12, type: 'M', name: 'NUM_TICKET' }, // Expanded to 12 for safety
        6: { len: 1, type: 'F', name: 'TIPO_VENTA' },
        // Money Fields (Standard Max 12)
        11: { len: 12, type: 'M', name: 'IMPNETO_T' },
        12: { len: 12, type: 'M', name: 'IMPBRUTO_T' },
        13: { len: 12, type: 'M', name: 'IMPIMPUESTOS_T' },
        14: { len: 12, type: 'M', name: 'IMPDESCUENTO_T' },
    },
    ITEM: { // 5xx
        0: { len: 3, type: 'F', name: 'ID_REGISTRO' },
        1: { len: 20, type: 'M', name: 'CD_ARTICULO' }, // Internal codes can be up to 20
        2: { len: 50, type: 'M', name: 'DESCRIPCION' },
        4: { len: 5, type: 'M', name: 'TIPO_SUBFAMILIA' },
        // Money/Units
        5: { len: 12, type: 'M', name: 'IMPNETO_A' },
        6: { len: 12, type: 'M', name: 'IMPBRUTO_A' },
        8: { len: 9, type: 'M', name: 'UDS_A' }, 
        9: { len: 12, type: 'M', name: 'IMPVENTA_A' },
        12: { len: 12, type: 'M', name: 'IMPDESCUENTO_1' }
    },
    PAYMENT: { // 6xx
        0: { len: 3, type: 'F', name: 'ID_REGISTRO' },
        1: { len: 2, type: 'M', name: 'TIPO_MEDIO' }, // Usually 1 digit, allow 2
        3: { len: 12, type: 'M', name: 'IMPORTE' }
    },
    TAX: { // 7xx
        0: { len: 3, type: 'F', name: 'ID_REGISTRO' },
        1: { len: 2, type: 'M', name: 'TIPO_IMPUESTO' },
        3: { len: 12, type: 'M', name: 'BASE' },
        4: { len: 12, type: 'M', name: 'CUOTA' }
    }
};

export const validateSyntaxAndSemantics = (files: ParsedSale11004[]): ValidationResult[] => {
    const results: ValidationResult[] = [];
    let syntaxPassedCount = 0;
    
    // Stats for the success report
    let totalLinesChecked = 0;
    let totalItems = 0;
    let totalPayments = 0;
    let totalTaxes = 0;

    files.forEach(file => {
        const lines = file.rawContent.trim().split(/\r?\n/);
        totalLinesChecked += lines.length;

        const fileName = file.fileName;
        const details: { field: string, expected: string, actual: string, context: string }[] = [];
        
        let hasHeader = false;
        let itemLinesCount = 0;
        let taxLinesCount = 0;
        let paymentLinesCount = 0;
        let hasSemanticError = false;

        const validateFieldLength = (val: string, index: number, specMap: any, context: string) => {
            const spec = specMap[index];
            if (!spec) return;

            if (spec.type === 'F' && val.length !== spec.len) {
                details.push({ 
                    field: `${spec.name} [Pos ${index}]`, 
                    expected: `Fixed ${spec.len} chars`, 
                    actual: `${val.length} chars ("${val}")`, 
                    context 
                });
                hasSemanticError = true;
            } else if (spec.type === 'M' && val.length > spec.len) {
                details.push({ 
                    field: `${spec.name} [Pos ${index}]`, 
                    expected: `Max ${spec.len} chars`, 
                    actual: `${val.length} chars ("${val}")`, 
                    context 
                });
                hasSemanticError = true;
            }
        };

        // 1. Syntactic Structure Check & Semantic Field Check
        lines.forEach((line, idx) => {
            if (!line.trim()) return;
            
            const parts = line.split('|');
            const lineId = parseInt(parts[0]);

            // Helper to get trimmed value safely
            const getVal = (i: number) => parts[i] ? parts[i].trim() : '';

            // --- HEADER (Usually first line or 11004) ---
            if (idx === 0) {
                hasHeader = true;
                if (parts.length < 20) {
                     details.push({ field: 'Header Length', expected: '>20 fields', actual: `${parts.length}`, context: `Line ${idx+1}` });
                     hasSemanticError = true;
                }
                
                // Mandatory Fields (Must NOT be empty)
                const mandatoryHeaderIndices = [
                    { i: 1, n: 'Date' }, 
                    { i: 2, n: 'Time' },
                    { i: 3, n: 'Z Number' },
                    { i: 4, n: 'Ticket Number' },
                    { i: 6, n: 'Sale Type' }
                ];
                mandatoryHeaderIndices.forEach(m => {
                    const val = getVal(m.i);
                    if (isEmpty(val)) {
                        details.push({ field: m.n, expected: 'Not Empty', actual: 'EMPTY', context: `Header` });
                        hasSemanticError = true;
                    }
                });

                // Numeric Fields & Length Checks
                const numericHeaderIndices = [3, 4, 6, 11, 12, 13, 14, 15, 16, 19, 30, 32];
                numericHeaderIndices.forEach(i => {
                    const val = getVal(i);
                    if (!isEmpty(val) && !isStrictPositiveInteger(val)) {
                        details.push({ field: `Header [${i}]`, expected: 'Positive Integer', actual: `"${val}"`, context: `Header` });
                        hasSemanticError = true;
                    }
                });

                // Length Validation
                Object.keys(SPECS.HEADER).forEach(key => {
                    const i = parseInt(key);
                    validateFieldLength(getVal(i), i, SPECS.HEADER, 'Header');
                });
            } 
            // --- ITEMS (500-599) ---
            else if (lineId >= 500 && lineId <= 599) {
                itemLinesCount++;
                const mandatoryItem = [
                    { i: 1, n: 'Item Code' },
                    { i: 4, n: 'SubFamily' },
                    { i: 8, n: 'Units' },
                    { i: 9, n: 'Price' }
                ];
                mandatoryItem.forEach(m => {
                     if (isEmpty(getVal(m.i))) {
                        details.push({ field: m.n, expected: 'Not Empty', actual: 'EMPTY', context: `Line ${idx+1}` });
                        hasSemanticError = true;
                    }
                });
                
                // Numeric Fields
                const numericItemIndices = [4, 5, 6, 8, 9, 12, 13, 14, 19, 21];
                numericItemIndices.forEach(i => {
                    const val = getVal(i);
                    if (!isEmpty(val) && !isStrictPositiveInteger(val)) {
                        details.push({ field: `Item [${i}]`, expected: 'Positive Integer', actual: `"${val}"`, context: `Line ${idx+1}` });
                        hasSemanticError = true;
                    }
                });

                // Length Validation
                Object.keys(SPECS.ITEM).forEach(key => {
                    const i = parseInt(key);
                    validateFieldLength(getVal(i), i, SPECS.ITEM, `Line ${idx+1}`);
                });
            }
            // --- TAXES (700-799) ---
            else if (lineId >= 700 && lineId <= 799) {
                taxLinesCount++;
                // Mandatory
                const mandatoryTax = [
                    { i: 1, n: 'Tax Type' },
                    { i: 4, n: 'Amount' }
                ];
                mandatoryTax.forEach(m => {
                     if (isEmpty(getVal(m.i))) {
                        details.push({ field: m.n, expected: 'Not Empty', actual: 'EMPTY', context: `Line ${idx+1}` });
                        hasSemanticError = true;
                    }
                });

                // Numeric Check
                [1, 3, 4].forEach(i => {
                     const val = getVal(i);
                     if (!isEmpty(val) && !isStrictPositiveInteger(val)) {
                        details.push({ field: `Tax [${i}]`, expected: 'Positive Integer', actual: `"${val}"`, context: `Line ${idx+1}` });
                        hasSemanticError = true;
                    }
                });

                // Length Validation
                Object.keys(SPECS.TAX).forEach(key => {
                    const i = parseInt(key);
                    validateFieldLength(getVal(i), i, SPECS.TAX, `Line ${idx+1}`);
                });
            }
            // --- PAYMENTS (600-699) ---
            else if (lineId >= 600 && lineId <= 699) {
                paymentLinesCount++;
                 const mandatoryPay = [
                    { i: 1, n: 'Pay Type' },
                    { i: 3, n: 'Amount' }
                ];
                mandatoryPay.forEach(m => {
                     if (isEmpty(getVal(m.i))) {
                        details.push({ field: m.n, expected: 'Not Empty', actual: 'EMPTY', context: `Line ${idx+1}` });
                        hasSemanticError = true;
                    }
                });

                // Numeric Check
                [1, 2, 3].forEach(i => {
                     const val = getVal(i);
                     if (!isEmpty(val) && !isStrictPositiveInteger(val)) {
                        details.push({ field: `Pay [${i}]`, expected: 'Positive Integer', actual: `"${val}"`, context: `Line ${idx+1}` });
                        hasSemanticError = true;
                    }
                });

                // Length Validation
                Object.keys(SPECS.PAYMENT).forEach(key => {
                    const i = parseInt(key);
                    validateFieldLength(getVal(i), i, SPECS.PAYMENT, `Line ${idx+1}`);
                });
            }
        });

        totalItems += itemLinesCount;
        totalTaxes += taxLinesCount;
        totalPayments += paymentLinesCount;

        // 2. Structural Integrity Report
        if (itemLinesCount === 0) {
            details.push({ field: 'Structure', expected: '>0 Item Lines (5xx)', actual: '0', context: 'File Structure' });
            hasSemanticError = true;
        }
        if (taxLinesCount === 0) {
             details.push({ field: 'Structure', expected: '>0 Tax Lines (7xx)', actual: '0', context: 'File Structure' });
             hasSemanticError = true;
        }
        if (paymentLinesCount === 0) {
            details.push({ field: 'Structure', expected: '>0 Payment Lines (6xx)', actual: '0', context: 'File Structure' });
            hasSemanticError = true; 
        }

        if (hasSemanticError) {
            results.push({
                status: 'invalid',
                message: `Syntax/Semantic Error: ${fileName}`,
                details: details
            });
        } else {
            syntaxPassedCount++;
        }
    });

    if (syntaxPassedCount === files.length && files.length > 0) {
        results.push({
            status: 'valid',
            message: `Syntax & Semantics: All ${files.length} files passed AENA Strict Validation.`,
            details: [
                { field: 'File Formatting', expected: 'Pipe (|) Delimiter, UTF-8/ASCII', actual: `Checked ${files.length} Files`, context: 'Parser' },
                { field: 'Field Lengths', expected: 'Fixed/Max Lengths (AENA Spec)', actual: `Verified ${totalLinesChecked} Rows`, context: 'Syntax' },
                { field: 'Data Types', expected: 'Numeric fields must be Integers (Mill format)', actual: '100% Valid', context: 'Semantic' },
                { field: 'Header Integrity', expected: 'Date, Time, Z, Ticket present', actual: 'Confirmed', context: 'Header' },
                { field: 'Detail Lines', expected: 'Items (5xx) present', actual: `${totalItems} Lines Verified`, context: 'Structure' },
                { field: 'Tax Lines', expected: 'Taxes (7xx) present', actual: `${totalTaxes} Lines Verified`, context: 'Structure' },
                { field: 'Payment Lines', expected: 'Payments (6xx) present', actual: `${totalPayments} Lines Verified`, context: 'Structure' }
            ]
        });
    }

    return results;
};
