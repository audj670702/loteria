// Conserva botones e imágenes entre cantos; sólo crea casillas al cambiar el cartón.
export function createBoardView({container,createTile,updateTile}){
  let order=[],tiles=new Map();
  return {
    render(ids){
      const changed=order.length!==ids.length||ids.some((id,i)=>id!==order[i]);
      if(changed){
        const next=new Map(ids.map(id=>[id,tiles.get(id)||createTile(id)]));
        container.replaceChildren(...ids.map(id=>next.get(id)));
        tiles=next;order=[...ids];
      }
      for(const id of ids)updateTile(tiles.get(id),id);
    },
    reset(){order=[];tiles.clear();container.replaceChildren();}
  };
}
