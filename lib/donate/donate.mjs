import mysql from "mysql2"

// define OUTSIDE so it closes automatically
const pool = mysql.createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
})

// Promise wrapper so every query can just be awaited
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, rows) => {
      if (error) {
        console.error(error.sqlMessage)
        reject(new Error("Donation rejected"))
      } else {
        resolve(rows)
      }
    })
  })
}

export const handler = async (event) => {
  let result
  let code

  try {
    // API Gateway sends the JSON as a string in event.body
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event

    // 400: missing fields
    if (
      !body ||
      typeof body.destination !== "string" ||
      body.destination.trim() === "" ||
      body.items === undefined
    ) {
      throw new Error("missing fields") //400: generic missing fields
    }

    // 400: no items
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new Error("no items")
    }

    const items = body.items

    //Does the donation center exist + grab its organization
    const dcRows = await query(
      "SELECT dc_id, orgo_id FROM DonationCenter WHERE dc_name = ?",
      [body.destination]
    )
    if (!Array.isArray(dcRows) || dcRows.length !== 1) {
      throw new Error("invalid destination") // 400
    }
    const dcId = dcRows[0].dc_id
    const orgoId = dcRows[0].orgo_id

    //Check every item skiping items that don't match the databse and recorded the as `malformed`
    const donated = [] // what wil later be outputed to the Donor: { name, value }
    const merged = new Map() // used in the database, key: "itemId|value" -> { itemId, value, qty }
    const malformed = [] // Improperly inputed items output to Donor: { itemId, value, reason }
    let totalValue = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const itemId = item?.itemId
      const value = item?.value

      // malformed: wrong shape
      if (!Number.isInteger(itemId) || typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        malformed.push({ itemId, value, reason: "improper Item Entry" })
        continue
      }

      // malformed: item doesn't exist in this donation center's organization
      const itemRows = await query(
        "SELECT Item.item_name, Item.item_lowlimit, Item.item_highlimit FROM Item JOIN Category ON Item.cat_id = Category.cat_id WHERE Item.item_id = ? AND Category.orgo_id = ?",
        [itemId, orgoId]
      )
      if (!Array.isArray(itemRows) || itemRows.length === 0) {
        malformed.push({ itemId, value, reason: "item does not exist" })
        continue
      }

      // bind the value to the item's allowed range (below low -> low, above high -> high)
      // then round to cents so matching against stored values is reliable
      const found = itemRows[0]
      const boundedValue = Math.round(
        Math.min(
          Math.max(value, Number(found.item_lowlimit)),
          Number(found.item_highlimit)
        ) * 100
      ) / 100

      // good item
      donated.push({ name: found.item_name, value: boundedValue })

      // merge identical items (same item and value) into one line with a combined quantity
      const key = `${itemId}|${boundedValue}`
      const line = merged.get(key) ?? { itemId, value: boundedValue, qty: 0 }
      line.qty += 1 // each donated item counts as 1
      merged.set(key, line)

      totalValue += boundedValue
    }
  // 400: every item was malformed -> nothing was donated
    if (merged.size === 0) {
      result = { error: "invalid category or items", malformed }
      code = 400
    } else {
      // Save the good items + raise the quantity of an existing instance when the donation center already has the same item and value
      // otherwise create a new instance
      for (const line of merged.values()) {
        const updated = await query(
          "UPDATE ItemInstance SET inst_qty = inst_qty + ? " +
            "WHERE dc_id = ? AND item_id = ? AND inst_value = ? AND inst_wishliststatus = 0 LIMIT 1",
          [line.qty, dcId, line.itemId, line.value]
        )

        // Nothing matched, so create a new instance
        if (updated.affectedRows === 0) {
          await query(
            "INSERT INTO ItemInstance (dc_id, item_id, inst_qty, inst_value, inst_wishliststatus) VALUES (?, ?, ?, ?, 0)",
            [dcId, line.itemId, line.qty, line.value]
          )
        }
      }

      // TODO: generate the PDF and return its link
      result = {//temporary result to read output
        message: "donation complete",
        donated,
        total_Value: Math.round(totalValue * 100) / 100,
        not_Donated: malformed,
      }
      code = 200
    }
  } catch (error) {
    //anything unexpected is a generic rejection
    const known = ["missing fields", "no items", "invalid destination", "Donation rejected"]
    result = { error: known.includes(error.message) ? error.message : "Donation rejected" }
    code = 400
  }

  const response = {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(result),
  }

  return response
}