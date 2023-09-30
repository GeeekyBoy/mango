export let message = "";

export default async ({ route }) => {
  if (Object.prototype.hasOwnProperty.call(route.query, "user")) {
    return {
      data: {
        message: `Welcome to the forbidden page!`,
      }
    }
  } else {
    return {
      statusCode: 403,
      data: {
        message: "Forbidden",
      }
    }
  }
};
