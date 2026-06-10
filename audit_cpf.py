import pandas as pd
import openpyxl

def audit_cpf():
    file_path = 'CPF.xlsx'
    try:
        # Load the workbook to inspect sheets
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheets = wb.sheetnames
        print(f"Sheets found: {sheets}")

        for sheet_name in sheets:
            print(f"\n--- Auditing Sheet: {sheet_name} ---")
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            print(f"Data Preview:\n{df.head(10)}")
            
            # Search for keywords related to OW ceiling or CPF rules
            found_ceiling = False
            for index, row in df.iterrows():
                row_str = " ".join([str(val) for val in row.values])
                if "ceiling" in row_str.lower() or "ordinary wage" in row_str.lower() or "8000" in row_str:
                    print(f"Potential rule found at row {index+2}: {row_str}")
                    found_ceiling = True
            
            if not found_ceiling:
                print("No explicit mention of OW ceiling found in this sheet.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    audit_cpf()
