export interface Media {
    id:         number;
    path:       string;
    filename:   string;
    size:       number;
    duration?:  number;
    width?:     number;
    height?:    number;
    views:      number;
    inserted_at:string;
    tags:       Tag[];
    faces:      Face[];
  }
  
  export interface Tag {
    id:    number;
    name:  string;
  }
  
  export interface Face {
    id:        number;
    media_id:  number;
    person_id?:number;
    person?:   Person;
    embedding: number[];
  }
  
  export interface Person {
    id:        number;
    name?:     string;
    age?:      number;
    gender?:   string;
    ethnicity?:string;
    faceUrl?:  string;  // you may need to add this field in your API
  }
  