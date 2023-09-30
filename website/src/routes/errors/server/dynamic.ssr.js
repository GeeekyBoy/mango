export let name = "";

export default async ({ route }) => {
  const name = route.query["name"];
  return {
    data: {
      name: name.trim(),
    }
  };
};
