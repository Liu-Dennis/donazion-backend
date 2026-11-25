import mysql, { Pool } from "mysql2"

const pool: Pool = mysql.createPool({
  host: process.env.RDS_HOST!,
  user: process.env.RDS_USER!,
  password: process.env.RDS_PASSWORD!,
  database: process.env.RDS_DATABASE!,
})

interface DatabaseDonationCenter {
  dc_name: string
  dc_latitude: number
  dc_longitude: number
  dc_address: string
  dc_city: string
  dc_state: string
  dc_zipcode: string
  dc_id: string
  orgo_id: string
}
interface grandValue {
  dc_grandValue: number
}

interface grandNumber {
  dc_grandNumber: number
}


export const handler = async (event: any): Promise<DatabaseDonationCenter | any | undefined>  => {
  let code
  let result

  //comment #1
  //comment #2

  try {
    const userId: string = JSON.parse(event.body).userId

    const getDonationCenterLocInfo = () => {
      return new Promise((resolve, reject) => {
        const selectQuery = "SELECT * FROM DonationCenter WHERE dc_id = ?"
        pool.query(selectQuery, [userId], (error, results) => {
          //error is any potential error codes, results is an array, where each instance is a tuple
          if (error) {
            return reject(error)
          }
          if (Array.isArray(results) && results.length == 1) {
            const dcInfo: DatabaseDonationCenter =
              results[0] as DatabaseDonationCenter
            return resolve({
              address: dcInfo.dc_address,
              city: dcInfo.dc_city,
              id: dcInfo.dc_id,
              zipcode: dcInfo.dc_zipcode,
              lat: dcInfo.dc_latitude,
              long: dcInfo.dc_longitude,
              name: dcInfo.dc_name,
            })
          } else {
            return resolve(undefined)
          }
        })
      })
    }

    const getGrandNumItems = () => {
      return new Promise((resolve, reject) => {
        const selectQuery = "SELECT SUM(ItemInstance.inst_qty) as dc_grandNumber FROM DonationCenter LEFT JOIN ItemInstance ON DonationCenter.dc_id = ItemInstance.dc_id WHERE DonationCenter.dc_id = ?"
        pool.query(selectQuery, [userId], (error, results) => {
          if (error) {
            return reject(error)
          }
          if (Array.isArray(results) && results.length == 1) {
            const dcNumItems: grandNumber = results[0] as grandNumber
            return resolve(dcNumItems.dc_grandNumber)
          } else {
            return resolve(undefined)
          }
        })
      })
    }

    const getGrandNumValues = () => {
      return new Promise((resolve, reject) => {
        const selectQuery = "SELECT SUM(ItemInstance.inst_value * ItemInstance.inst_qty) as dc_grandValue FROM DonationCenter LEFT JOIN ItemInstance ON DonationCenter.dc_id = ItemInstance.dc_id WHERE DonationCenter.dc_id = ?"
        pool.query(selectQuery, [userId], (error, results) => {
          if(error){ return reject(error)}
          if(Array.isArray(results) && results.length == 1){ 
            const dcValue: grandValue = results[0] as grandValue
            return resolve(dcValue.dc_grandValue)
          } else {
            return resolve(undefined)
          }
        })
      })
    }

    const getCategoriesItemsValue = () => {
      return new Promise((resolve, reject) => {
        const selectQuery = "SELECT Category.cat_name, COUNT(ItemInstance.inst_id) AS cat_itemCount, SUM(ItemInstance.inst_qty * ItemInstance.inst_value) AS cat_totalValue FROM DonationCenter JOIN ItemInstance ON DonationCenter.dc_id = ItemInstance.dc_id JOIN Item ON ItemInstance.item_id = Item.item_id JOIN Category ON Item.cat_id = Category.cat_id WHERE DonationCenter.dc_id = ? GROUP BY Category.cat_id, Category.cat_name"
        //the SQL query is both beautiful, and horrifying, to be hold
        pool.query(selectQuery, [userId], (error,results) => {
          if(error){ return reject(error)}
          if(Array.isArray(results) && results.length >= 1){
            //const catItemVals: categoryNameItemVal = results as categoryNameItemVal
            //const resultValues: grandValue[]
            return resolve(results || [])
          } else {
            return resolve([])
          }
        })
      })
    }

    //const donationCenterInformaiton = await getDonationCenterLocInfo()
    const donationCenterItemQuantity = await getGrandNumItems()
    const donationCenterItemValue = await getGrandNumValues()
    const donationCenterCatItemsValue = await getCategoriesItemsValue()
    //pool.end()

    result = {
      grandItems: donationCenterItemQuantity,
      grandValue: donationCenterItemValue,
      categoryInfo: donationCenterCatItemsValue,
    }
    code = 200
  } catch (error) {
    result =
      error instanceof Error
        ? error.message
        : "An unexpected error has occurred"
    code = 400
  }
  const response = {
    statusCode: code,
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST"
    },
    body: JSON.stringify(result),
  }

  return response
}
