# 💰 Extra Amount Feature Implementation

## Overview
Added support for an "Extra Amount" field for employees that will be included in payroll calculations and saved to the database.

## Changes Made

### 1. Database Schema Update
**File: `src/types/firestore.ts`**
- Added `extraAmount?: number` field to the `Employee` interface
- Default value is 0 when not specified

```typescript
export interface Employee {
  name: string;
  ccssType: 'TC' | 'MT';
  extraAmount?: number; // Monto extra, valor inicial 0
}
```

### 2. Data Editor UI Enhancement
**File: `src/edit/DataEditor.tsx`**
- Added UI input field for extra amount in employee management
- Added header row to clarify column purposes
- Added `updateEmployeeExtraAmount` function to handle field updates
- Updated employee creation to include `extraAmount: 0` by default
- Added migration logic to ensure existing employees get `extraAmount: 0`

**New UI Features:**
- Input field with currency format (₡)
- Numeric input with step validation (0.01)
- Placeholder text and tooltip for clarity
- Header row showing "Monto Extra (₡)" column

### 3. Payroll Calculation Integration
**File: `src/components/PayrollExporter.tsx`**
- Updated `EmployeePayrollData` interface to include `extraAmount` field
- Modified `calculatePayrollData` function to accept and use extra amount
- Updated payroll calculation to include extra amount in total income
- Added "Monto Extra" row in payroll display table
- Updated CSV export to include extra amount data

**Payroll Integration:**
```typescript
// Extra amount is added to total income calculation
const totalIncome = regularTotal + overtimeTotal + otrosTotal + extraAmount;
```

### 4. Database Migration
- Automatic migration for existing employees without `extraAmount` field
- Backward compatibility maintained with existing data structure
- Default value of 0 assigned to existing employees

## Usage Instructions

### For Administrators (Data Editor):
1. Navigate to "Editor de Datos" → "Ubicaciones"
2. Select an existing location or create a new one
3. In the employee section, you'll see three columns:
   - **Nombre del Empleado**: Employee name
   - **Tipo CCSS**: Employment type (TC/MT)
   - **Monto Extra (₡)**: Extra amount in colones
4. Enter the extra amount for each employee (defaults to 0)
5. Click "Guardar" to save changes to database

### For Payroll Generation:
1. Navigate to the Payroll section
2. Select the desired period and location
3. The extra amount will automatically appear as "Monto Extra" row in each employee's payroll
4. The extra amount is included in the total income calculation
5. Export functionality includes the extra amount in CSV files

## Technical Details

### Data Flow:
1. **Input**: Admin enters extra amount in Data Editor
2. **Storage**: Saved to Firebase under location.employees[].extraAmount
3. **Retrieval**: PayrollExporter reads employee data including extra amount
4. **Calculation**: Extra amount added to total income
5. **Display**: Shown as separate line item in payroll table
6. **Export**: Included in CSV export as "Monto Extra" line

### Validation:
- Minimum value: 0
- Step: 0.01 (centavos)
- Input type: number
- Default value: 0

### Migration Strategy:
- Existing employees automatically get `extraAmount: 0`
- No data loss during migration
- Backward compatibility maintained
- Auto-migration on data load

## Files Modified:
1. `src/types/firestore.ts` - Database schema
2. `src/edit/DataEditor.tsx` - UI and data management
3. `src/components/PayrollExporter.tsx` - Payroll calculations and display

## Database Impact:
- ✅ Backward compatible
- ✅ No breaking changes
- ✅ Automatic migration
- ✅ Default values handled
- ✅ Data integrity maintained

## Testing Recommendations:
1. Test employee creation with extra amount
2. Test editing existing employees
3. Test payroll calculation with various extra amounts
4. Test CSV export includes extra amount
5. Test migration of existing employee data
6. Verify database saves extra amount correctly

---
**Status**: ✅ Complete and Ready for Production
**Database Impact**: Non-breaking, backward compatible
**Migration**: Automatic on data load
