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

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0
const isQuantity = (v) => Number.isInteger(v) && v > 0
const isValidInt = (v) => Number.isInteger(v) && v >= 0

const itemHasValidShape = (item) =>
    item && isNonEmptyString(item.name) && isNonEmptyString(item.category) && isQuantity(item.quantity) && isValidInt(item.value)


export const handler = async (event) => {
  let result
  let code

 try {
    // API Gateway sends the JSON as a string in event.body
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event

    // 400: missing fields
    if (!body || !isNonEmptyString(body.destination) || body.items === undefined) {
      throw new Error("missing fields")
    }

    // 400: no items
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new Error("no items")
    }

    const items = body.items

    //Does the donation center exist & what is its organization
    const dcRows = await query(
      "SELECT dc_id, orgo_id FROM DonationCenter WHERE dc_name = ?",
      [body.destination]
    )
    if (!Array.isArray(dcRows) || dcRows.length !== 1) {
      throw new Error("invalid destination") // 400
    }
    const dcId = dcRows[0].dc_id
    const orgoId = dcRows[0].orgo_id


    //Check every item, stopping at the first malformed or unknown one
    const rows = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // malformed item -> stop here
      if (
        !item ||
        !isNonEmptyString(item.name) ||
        !isNonEmptyString(item.category) ||
        !isPositiveInt(item.quantity) ||
        !isNonNegativeNumber(item.value)
      ) {
        throw new Error("invalid category or items") // 400
      }

    // item must exist, in a category that belongs to this donation center's organization
      const itemRows = await query(
        "SELECT Item.item_id FROM Item JOIN Category ON Item.cat_id = Category.cat_id WHERE Item.item_name = ? AND Category.cat_name = ? AND Category.orgo_id = ?",
        [item.name.trim(), item.category.trim(), orgoId]
      )
      if (!Array.isArray(itemRows) || itemRows.length === 0) {
        throw new Error("invalid category or items") // 400
      }

      rows.push([dcId, itemRows[0].item_id, item.quantity, item.value])
    }

  //TODO: 200 statment for all the items being correct
  //TOdo: 200 statement for some of the items being correct and some not
  //TODO: 400 statement for all the items or categories being incorrect
  //TODO: 400 missing fields generic
  //TODO: 400 donation rejected, generic



  const response = {
    statusCode: 200,
    body: JSON.stringify(result),
  }

  return response
}
