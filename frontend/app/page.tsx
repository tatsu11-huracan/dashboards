async function getUsers() {
  const res = await fetch("http://localhost:3000/api/users", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("ユーザー取得に失敗しました");
  }

  return res.json();
}

type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export default async function Home() {
  const users: User[] = await getUsers();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Users</h1>

      {users.length === 0 ? (
        <p>ユーザーがまだ登録されていません。</p>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li key={user.id} className="border rounded p-4">
              <div>ID: {user.id}</div>
              <div>Name: {user.name}</div>
              <div>Email: {user.email}</div>
              <div>Created At: {user.created_at}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}