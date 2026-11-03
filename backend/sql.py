import mysql.connector

try:
    # Connect to MySQL database
    con = mysql.connector.connect(
        host="localhost",
        port=3306,
        user="root",
        password="root",
        database="lipstick_db"
    )

    if con.is_connected():
        print("Connected to MySQL successfully!")

        cursor = con.cursor()

        # Execute SQL query
        cursor.execute("SELECT * FROM CUSTOMIZED_SHADE")

        # Display column names
        columns = [column[0] for column in cursor.description]
        print("\nColumns:", columns)

        # Display records
        records = cursor.fetchall()

        for record in records:
            print(record)

        cursor.close()
        con.close()

        print("\nDatabase connection closed.")

except mysql.connector.Error as err:
    print("Database Error:", err)